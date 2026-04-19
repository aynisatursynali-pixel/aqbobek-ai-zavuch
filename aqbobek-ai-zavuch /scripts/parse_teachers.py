import pandas as pd
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

file_path = DATA_DIR / "teachers_load.xlsx"
df = pd.read_excel(file_path, sheet_name="Жүктеме 2025-2026", header=None)

teachers = []
current_teacher = None
current_subjects = set()
current_load = 0

def clean_value(value):
    if pd.isna(value):
        return ""
    return str(value).strip()

CLASS_START_COL = 4

for idx in range(3, len(df)):
    row = df.iloc[idx]

    teacher_name = clean_value(row[1])
    subject = clean_value(row[3])

    if teacher_name:
        if current_teacher:
            teachers.append({
                "teacher_name": current_teacher,
                "subjects": sorted(list(current_subjects)),
                "weekly_load": current_load,
                "status": "active"
            })

        current_teacher = teacher_name
        current_subjects = set()
        current_load = 0

    if not current_teacher:
        continue

    if subject:
        current_subjects.add(subject.lower())

    row_load = 0
    for col in range(CLASS_START_COL, len(row)):
        value = row[col]
        if pd.isna(value):
            continue
        try:
            row_load += int(value)
        except:
            pass

    current_load += row_load

if current_teacher:
    teachers.append({
        "teacher_name": current_teacher,
        "subjects": sorted(list(current_subjects)),
        "weekly_load": current_load,
        "status": "active"
    })

with open(DATA_DIR / "teachers.json", "w", encoding="utf-8") as f:
    json.dump(teachers, f, ensure_ascii=False, indent=2)

print("Saved to data/teachers.json")
print("Total teachers:", len(teachers))