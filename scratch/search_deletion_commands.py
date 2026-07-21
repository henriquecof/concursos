import os
import json

log_path = r'C:\Users\miche\.gemini\antigravity\brain\4f9a0526-5962-4312-8549-21322d5c1120\.system_generated\logs\transcript.jsonl'
print("Searching entire transcript for file deletion or modifications...")
with open(log_path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        try:
            data = json.loads(line)
            step_index = data.get('step_index', 0)
            step_type = data.get('type')
            
            # Check for terminal command execution
            if 'RUN_COMMAND' in str(step_type) or 'run_command' in line:
                for tc in data.get('tool_calls', []):
                    if tc.get('name') == 'run_command':
                        cmd = str(tc.get('args', {}).get('CommandLine', ''))
                        if any(kw in cmd.lower() for kw in ['remove-item', 'rm', 'del ', 'rmdir', 'clear', 'clean', 'delete']):
                            print(f"Step {step_index} | Command: {cmd}")
                            
            # Check for file writes or deletes
            if step_type in ['WRITE_TO_FILE', 'WRITE_FILE', 'REPLACE_FILE_CONTENT']:
                for tc in data.get('tool_calls', []):
                    target = tc.get('args', {}).get('TargetFile', '')
                    if 'principal' in target.lower() or 'profiles' in target.lower():
                        print(f"Step {step_index} | File Edit: {step_type} on {target}")
        except Exception as e:
            pass
