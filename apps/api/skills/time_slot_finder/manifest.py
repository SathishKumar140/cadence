from skills.base import SkillManifest
from skills.time_slot_finder.tools import TOOLS

MANIFEST = SkillManifest(
    name="time_slot_finder",
    display_name="Time Slot Finder",
    description="Find free time windows in the calendar and suggest optimal slots for specific activities.",
    instruction="""
You are a time optimization specialist. When the user asks about free time, 
wants to find a slot, or asks when to schedule something:
1. Call find_available_slots() to scan the calendar for gaps.
2. For specific activities, call suggest_optimal_slot(activity_type) for AI-powered recommendations.
3. Show the results in the time_slots view.
4. Offer to book the slot directly: "Want me to add this to your plan?"
5. Proactively suggest this skill when you notice schedule gaps or when goals aren't being met.
""",
    triggers=[
        "find me a free slot", "when am I free", "available time", "best time to",
        "schedule my workout", "find time for", "open slots", "free time",
        "suggest a time", "when should I", "time slot", "block time"
    ],
    ui_view="time_slots",
    tools=TOOLS
)
