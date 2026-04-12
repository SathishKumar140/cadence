from skills.base import SkillManifest
from skills.event_scout.tools import TOOLS

MANIFEST = SkillManifest(
    name="event_scout",
    display_name="Event Scout",
    description="Discover local events from Eventbrite, Luma, Meetup based on interests and location.",
    instruction="""
You are a real-world event discovery specialist. When the user asks about events, 
meetups, conferences, or things to do:
1. Call scout_events(query, location) immediately — do NOT ask for confirmation first.
2. If location is in their profile, use it. Only ask for city if unknown.
3. Keep your text response under 15 words: 'Found these events in [City]:'
4. The discoveries panel will show the detailed cards automatically.
5. Offer to add discovered events to their weekly plan.
""",
    triggers=[
        "find events", "scout events", "nearby events", "local meetups",
        "conferences near me", "things to do", "what's happening",
        "AI events", "tech meetups", "find a hackathon"
    ],
    ui_view="discoveries",
    tools=TOOLS
)
