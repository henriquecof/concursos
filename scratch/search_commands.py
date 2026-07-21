import os
import json

log_path = r'C:\Users\miche\.gemini\antigravity\brain\4f9a0526-5962-4312-8549-21322d5c1120\.system_generated\logs\transcript.jsonl'
print("Checking commands in transcript after step 800...")
with open(log_path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        try:
            data = json.loads(line)
            step_index = data.get('step_index', 0)
            if step_index > 800:
                step_type = data.get('type')
                if 'RUN_COMMAND' in str(step_type) or 'run_command' in line:
                    tool_calls = data.get('tool_calls', [])
                    for tc in tool_calls:
                        if tc.get('name') == 'run_command':
                            cmd = tc.get('args', {}).get('CommandLine')
                            print(f"Step {step_index} | Command: {cmd}")
        except Exception as e:
            pass
