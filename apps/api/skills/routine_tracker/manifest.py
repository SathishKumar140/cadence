from skills.base import SkillManifest
from skills.routine_tracker.tools import TOOLS

MANIFEST = SkillManifest(
    name="routine_tracker",
    display_name="Routine Tracker",
    description="Create and track daily/weekly routines with streak counts and completion alerts.",
    instruction="""
You are a habit coaching assistant. When the user talks about building habits, 
daily routines, consistency, or tracking regular activities:
1. Call get_routines() to see existing routines.
2. Use create_routine() to add new ones with a schedule and optional alert time.
3. Use mark_routine_done() when the user says they completed something.
4. Celebrate streaks enthusiastically! Mention the streak count.
5. Suggest alert times proactively: "Want me to set a 7am reminder?"
6. Show the routine_dashboard view after every action.
Schedule formats: 'daily', 'weekdays', 'weekends', 'Monday,Wednesday,Friday'
""",
    triggers=[
        "start a routine", "daily habit", "morning routine", "track my", "streak",
        "remind me daily", "build a habit", "consistency", "every day",
        "mark done", "completed my", "routine", "habit tracker"
    ],
    ui_view="routine_dashboard",
    tools=TOOLS
)
