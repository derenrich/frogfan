import h5py
import json
import sys
import numpy as np

def extract_strings_from_refs(f, ref_dataset):
    strs = []
    if ref_dataset.dtype.kind == 'O':
        for ref in ref_dataset[:].flatten():
            obj = f[ref]
            chars = [chr(c[0]) for c in obj[:]]
            raw_path = ''.join(chars)
            # Normalize Windows backslashes to forward slashes for cross-platform compat
            strs.append(raw_path.replace('\\', '/'))
    return strs

def parse_mat(file_path):
    try:
        with h5py.File(file_path, 'r') as f:
            udExport = f['udExport']
            
            currframe = udExport['currframe'][:].flatten().tolist()
            currframe = [int(x) for x in currframe]
            
            video_files_refs = udExport['video']['files']
            video_files = extract_strings_from_refs(f, video_files_refs)
            num_videos = len(video_files)
            
            data = udExport['data']
            numpts = int(data['numpts'][0,0])
            dltcoef = data['dltcoef'][:].T.tolist()
            
            xypts_group = data['xypts']
            jc = xypts_group['jc'][:]
            ir = xypts_group['ir'][:]
            data_vals = xypts_group['data'][:]
            num_rows = int(xypts_group.attrs['MATLAB_sparse'])
            num_cols = len(jc) - 1
            
            # Reconstruct sparse matrix into dense
            dense = np.zeros((num_rows, num_cols))
            for col in range(num_cols):
                start = jc[col]
                end = jc[col+1]
                for idx in range(start, end):
                    row = ir[idx]
                    val = data_vals[idx]
                    dense[row, col] = val
                    
            annotations = {v: {} for v in video_files}
            
            for frame in range(num_rows):
                for video in range(num_videos):
                    media_path = video_files[video]
                    for label in range(numpts):
                        label_name = f"Point {label + 1}"
                        
                        col_x = 0 + video * 2 + label * (2 * num_videos)
                        col_y = 1 + video * 2 + label * (2 * num_videos)
                        
                        x = dense[frame, col_x]
                        y = dense[frame, col_y]
                        
                        if not (np.isnan(x) or np.isnan(y) or (x == 0 and y == 0)):
                            if frame not in annotations[media_path]:
                                annotations[media_path][frame] = {}
                            annotations[media_path][frame][label_name] = {"x": x, "y": y}
            
            res = {
                "currframe": currframe,
                "video_files": video_files,
                "numpts": numpts,
                "dltcoef": dltcoef,
                "annotations": annotations,
                "labelNames": [f"Point {i+1}" for i in range(numpts)]
            }
            
            print(json.dumps({"status": "success", "data": res}))
            
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "No file path provided"}))
        sys.exit(1)
    parse_mat(sys.argv[1])
