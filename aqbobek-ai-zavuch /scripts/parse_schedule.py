import pandas as pd
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

file_path = DATA_DIR / "schedule.xlsx"
df = pd.read_excel(file_path, sheet_name="сабақ кестесі", header=None)

records = []
current_day = None

class_columns = {
    "7A": (2, 3),
    "7B": (4, 5),
    "7C": (6, 7),
    "8A": (8, 9),
    "8B": (10, 11),
    "8C": (12, 13),
    "8D": (14, 15),
    "9A": (16, 17),
    "9B": (18, 19),
    "10A": (20, 21),
    "10B": (22, 23),
    "11A": (26, 27),
    "11B": (28, 29),
}

day_names = ["Дүйсенбі", "Сейсенбі", "Сәрсенбі", "Бейсенбі", "Жұма", "Сенбі"]

def clean_value(value):
    if pd.isna(value):
        return ""
    return str(value).replace("\xa0", " ").strip()

def detect_day(row):
    row_text = " | ".join(clean_value(x) for x in row.tolist())
    for day in day_names:
        if day in row_text:
            return day
    return None

def is_time_row(time_text, lesson_number):
    time_text = clean_value(time_text)
    lesson_number = clean_value(lesson_number)
    return (
        lesson_number.isdigit()
        and ("–" in time_text or "-" in time_text)
        and any(char.isdigit() for char in time_text)
    )

for idx in range(len(df)):
    row = df.iloc[idx]

    found_day = detect_day(row)
    if found_day:
        current_day = found_day
        continue

    col0 = clean_value(row[0])
    col1 = clean_value(row[1])

    if not is_time_row(col0, col1):
        continue

    for class_name, (subject_col, room_col) in class_columns.items():
        subject_teacher = clean_value(row[subject_col])
        room = clean_value(row[room_col])

        if subject_teacher == "":
            continue

        records.append({
            "day": current_day,
            "time": col0,
            "lesson": int(col1),
            "class": class_name,
            "subject_teacher": subject_teacher,
            "room": room
        })

with open(DATA_DIR / "master_schedule.json", "w", encoding="utf-8") as f:
    json.dump(records, f, ensure_ascii=False, indent=2)

print("Saved to data/master_schedule.json")
print("Total lessons parsed:", len(records))