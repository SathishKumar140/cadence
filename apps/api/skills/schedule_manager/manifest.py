from skills.base import SkillManifest
from skills.schedule_manager.tools import TOOLS

MANIFEST = SkillManifest(
    name="schedule_manager",
    display_name="Schedule Manager",
    description="View, add, update, or remove items from the weekly plan. Manage goals.",
    instruction="""
You are a proactive personal scheduler. When the user asks about their schedule, 
wants to add/move/delete activities, or asks to manage weekly goals:
1. Call get_weekly_plan() first to see the current state.
2. Use add_plan_item, update_plan_item, or remove_plan_item to apply changes.
3. Be specific about times (HH:MM-HH:MM format) and days (full name like "Monday").
4. After making changes, emit a ui_directive with view='schedule' so the dashboard refreshes.
5. If the user asks to 'plan for next week', you MUST call generate_priority_weekly_plan() to fetch interest-based suggestions.
""",
    triggers=[
        "show my schedule", "what's planned", "add to my plan", "move my workout",
        "reschedule", "delete from plan", "change my goals", "weekly plan",
        "what do I have this week", "optimize my schedule", "plan for next week"
    ],
    ui_view="schedule",
    tools=TOOLS,
    is_default=True
)
