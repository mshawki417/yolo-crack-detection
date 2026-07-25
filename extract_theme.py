import re
import json

html_path = r"C:\Users\Admin\Downloads\stitch_concrete_vision_ai\stitch_concrete_vision_ai\dashboard_crackdetect_ai\code.html"
css_path = r"C:\Users\Admin\.gemini\antigravity-ide\scratch\yolo-crack-detection\frontend\src\app\globals.css"

with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract tailwind config JSON
match = re.search(r'tailwind\.config\s*=\s*(\{.*?\});', content, re.DOTALL)
if match:
    config_str = match.group(1)
    # Fix unquoted keys if necessary, but looks like they are quoted in the HTML.
    try:
        config = json.loads(config_str)
        colors = config.get("theme", {}).get("extend", {}).get("colors", {})
        
        css_lines = ['@import "tailwindcss";', '', '@theme inline {']
        
        for name, hex_val in colors.items():
            css_lines.append(f'  --color-{name}: {hex_val};')
            
        css_lines.append('}')
        css_lines.append('')
        css_lines.append('@layer base {')
        css_lines.append('  body {')
        css_lines.append('    @apply bg-background text-on-background antialiased;')
        css_lines.append('  }')
        css_lines.append('}')
        
        with open(css_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(css_lines))
        print("Successfully updated globals.css with colors from Stitch.")
    except Exception as e:
        print("JSON parse error:", e)
else:
    print("Could not find tailwind config in HTML.")
