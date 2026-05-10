import unittest
import json
import subprocess
import os

class TestParseMat(unittest.TestCase):
    def test_parse_mat_output(self):
        script_path = os.path.join(os.path.dirname(__file__), 'parse_mat.py')
        mat_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'Frog06-20160531-Cal1auto-withDLT_dvProject.mat')
        
        self.assertTrue(os.path.exists(mat_file), "Test MAT file not found")
        
        # Run the script
        result = subprocess.run(
            ['python3', script_path, mat_file], 
            capture_output=True, 
            text=True
        )
        
        self.assertEqual(result.returncode, 0, f"Script failed with error: {result.stderr}")
        
        # Parse JSON output
        try:
            output = json.loads(result.stdout.strip())
        except json.JSONDecodeError:
            self.fail(f"Failed to parse JSON output: {result.stdout}")
            
        self.assertEqual(output.get("status"), "success", f"Parser reported error: {output.get('message')}")
        
        data = output.get("data", {})
        
        # Assertions on expected data structures based on the known MAT file
        self.assertIn("currframe", data)
        self.assertTrue(isinstance(data["currframe"], list))
        
        self.assertIn("video_files", data)
        self.assertEqual(len(data["video_files"]), 3, "Expected exactly 3 video files in the cell array")
        
        self.assertIn("numpts", data)
        self.assertEqual(data["numpts"], 2, "Expected 2 labels based on the sparse matrix sizing")
        
        self.assertIn("dltcoef", data)
        self.assertEqual(len(data["dltcoef"]), 11, "DLT coefficients should have 11 rows")
        self.assertEqual(len(data["dltcoef"][0]), 3, "DLT coefficients should have 3 columns (one for each video)")
        
        self.assertIn("annotations", data)
        
        # Pick one video file and verify annotations format
        video1 = data["video_files"][0]
        self.assertIn(video1, data["annotations"])
        
        # Check if there are some frames annotated
        frames = list(data["annotations"][video1].keys())
        self.assertGreater(len(frames), 0, "No frames were annotated")
        
        first_annotated_frame = frames[0]
        annotations_in_frame = data["annotations"][video1][first_annotated_frame]
        
        # Verify the structure: { "Point 1": {"x": 123, "y": 456} }
        self.assertTrue(isinstance(annotations_in_frame, dict))
        point_keys = list(annotations_in_frame.keys())
        self.assertGreater(len(point_keys), 0)
        
        point_data = annotations_in_frame[point_keys[0]]
        self.assertIn("x", point_data)
        self.assertIn("y", point_data)

if __name__ == '__main__':
    unittest.main()
