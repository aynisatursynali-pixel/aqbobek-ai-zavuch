import json
import re
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

with open(DATA_DIR / "master_schedule.json", "r", encoding="utf-8") as f:
    schedule = json.load(f)

with open(DATA_DIR / "teachers.json", "r", encoding="utf-8") as f:
    teachers = json.load(f)

ABSENT_TEACHER = "Гореева А.М."
TARGET_DAY = "Дүйсенбі"
TARGET_LESSON = None
TARGET_SUBJECT = None
TARGET_CLASS = None

if len(sys.argv) >= 6:
    ABSENT_TEACHER = sys.argv[1]
    TARGET_DAY = sys.argv[2]
    TARGET_LESSON = int(sys.argv[3]) if sys.argv[3].isdigit() else None
    TARGET_SUBJECT = sys.argv[4].strip()
    TARGET_CLASS = sys.argv[5].strip().upper()


def normalize_text(text):
    return str(text).lower().replace(".", "").replace("  ", " ").strip()


def clean_teacher_name(name):
    name = re.sub(r"\(.*?\)", "", name)
    return name.strip()


def extract_subject(subject_teacher, teacher_name):
    return subject_teacher.replace(teacher_name, "").strip()


def teacher_is_busy(teacher_name, day, lesson_number):
    teacher_name_norm = normalize_text(teacher_name)
    for lesson in schedule:
        lesson_teacher_norm = normalize_text(lesson.get("subject_teacher", ""))
        if (
            lesson["day"] == day
            and lesson["lesson"] == lesson_number
            and teacher_name_norm in lesson_teacher_norm
        ):
            return True
    return False


def subject_matches(candidate_subjects, target_subject):
    target_norm = normalize_text(target_subject)
    for subj in candidate_subjects:
        subj_norm = normalize_text(subj)
        if target_norm in subj_norm or subj_norm in target_norm:
            return True
    return False


def get_surname_and_first_initial(name):
    name = clean_teacher_name(name)
    parts = name.split()

    if not parts:
        return "", ""

    surname = parts[0].lower()
    first_initial = ""

    if len(parts) >= 2:
        initials_match = re.match(r"([А-ЯA-ZӘІҢҒҮҰҚӨҺ])", parts[1], re.IGNORECASE)
        if initials_match:
            first_initial = initials_match.group(1).lower()

    if len(parts) >= 2 and not first_initial:
        first_initial = parts[1][0].lower()

    return surname, first_initial


def is_same_person(name1, name2):
    surname1, initial1 = get_surname_and_first_initial(name1)
    surname2, initial2 = get_surname_and_first_initial(name2)
    return surname1 == surname2 and initial1 == initial2


teacher_lessons = []

if TARGET_LESSON and TARGET_SUBJECT and TARGET_CLASS:
    matched = False
    for lesson in schedule:
        if (
            lesson["day"] == TARGET_DAY
            and lesson["lesson"] == TARGET_LESSON
            and lesson["class"].upper() == TARGET_CLASS
        ):
            teacher_lessons.append({
                **lesson,
                "subject_teacher": f"{TARGET_SUBJECT} {ABSENT_TEACHER}"
            })
            matched = True

    if not matched:
        teacher_lessons.append({
            "day": TARGET_DAY,
            "time": "-",
            "lesson": TARGET_LESSON,
            "class": TARGET_CLASS,
            "subject_teacher": f"{TARGET_SUBJECT} {ABSENT_TEACHER}",
            "room": "-"
        })
else:
    for lesson in schedule:
        if lesson["day"] == TARGET_DAY and ABSENT_TEACHER in lesson["subject_teacher"]:
            teacher_lessons.append(lesson)

substitutions = []

for missing_lesson in teacher_lessons:
    subject = extract_subject(missing_lesson["subject_teacher"], ABSENT_TEACHER).strip()
    lesson_number = missing_lesson["lesson"]
    candidates = []

    for teacher in teachers:
        teacher_name = teacher["teacher_name"]

        if is_same_person(teacher_name, ABSENT_TEACHER):
            continue
        if teacher.get("status") != "active":
            continue
        if not subject_matches(teacher["subjects"], subject):
            continue
        if teacher_is_busy(teacher_name, TARGET_DAY, lesson_number):
            continue

        score = 100 - teacher["weekly_load"]

        candidates.append({
            "teacher_name": teacher_name,
            "weekly_load": teacher["weekly_load"],
            "score": score,
            "reason": [
                f"ведёт этот предмет: {subject}",
                f"свободен(а) в этот урок: {lesson_number}",
                "активный статус",
                f"меньшая недельная нагрузка: {teacher['weekly_load']}"
            ]
        })

    candidates = sorted(candidates, key=lambda x: x["score"], reverse=True)

    if candidates:
        best = candidates[0]
        substitutions.append({
            "day": missing_lesson["day"],
            "time": missing_lesson["time"],
            "lesson": missing_lesson["lesson"],
            "class": missing_lesson["class"],
            "subject": subject,
            "room": missing_lesson["room"],
            "absent_teacher": ABSENT_TEACHER,
            "substitute_teacher": best["teacher_name"],
            "all_candidates": [c["teacher_name"] for c in candidates[:3]],
            "reason": best["reason"],
            "status": "proposed"
        })
    else:
        substitutions.append({
            "day": missing_lesson["day"],
            "time": missing_lesson["time"],
            "lesson": missing_lesson["lesson"],
            "class": missing_lesson["class"],
            "subject": subject,
            "room": missing_lesson["room"],
            "absent_teacher": ABSENT_TEACHER,
            "substitute_teacher": None,
            "all_candidates": [],
            "reason": ["подходящий свободный учитель не найден"],
            "status": "unresolved"
        })

with open(DATA_DIR / "substitutions.json", "w", encoding="utf-8") as f:
    json.dump(substitutions, f, ensure_ascii=False, indent=2)

print("Saved to data/substitutions.json")
print("Total substitution records:", len(substitutions))