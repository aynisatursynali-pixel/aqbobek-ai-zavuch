import re
import json

messages = [
    "7A - 15 детей, 2 болеют",
    "7C 20, отсутствуют 3",
    "8B 18 присутствуют",
    "9A 21, 1 нет",
    "10A - 24 ученика, 2 отсутствуют"
]

parsed_reports = []

def parse_attendance(message):
    text = message.strip()

    class_match = re.search(r"\b(7A|7B|7C|8A|8B|8C|8D|9A|9B|10A|10B|11A|11B)\b", text)
    if not class_match:
        return None

    class_name = class_match.group(1)

    numbers = [int(n) for n in re.findall(r"\d+", text)]

    # первое число обычно номер класса, поэтому берём остальные
    filtered_numbers = [n for n in numbers if n not in [7, 8, 9, 10, 11]]

    present = None
    absent = 0

    if "болеют" in text or "отсутств" in text or "нет" in text:
        if len(filtered_numbers) >= 2:
            present = filtered_numbers[0]
            absent = filtered_numbers[1]
        elif len(filtered_numbers) == 1:
            present = filtered_numbers[0]
    else:
        if len(filtered_numbers) >= 1:
            present = filtered_numbers[0]

    return {
        "class": class_name,
        "present": present,
        "absent": absent,
        "message_text": message
    }

for msg in messages:
    result = parse_attendance(msg)
    if result:
        parsed_reports.append(result)

total_present = sum(item["present"] for item in parsed_reports if item["present"] is not None)
total_absent = sum(item["absent"] for item in parsed_reports if item["absent"] is not None)

with open("data/attendance_reports.json", "w", encoding="utf-8") as f:
    json.dump(parsed_reports, f, ensure_ascii=False, indent=2)

print("=== PARSED ATTENDANCE ===")
for item in parsed_reports:
    print(item)

print()
print("Total present:", total_present)
print("Total absent:", total_absent)
print("Saved to data/attendance_reports.json")