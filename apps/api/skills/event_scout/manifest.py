from skills.base import SkillManifest
from skills.event_scout.tools import TOOLS

MANIFEST = SkillManifest(
    name="event_scout",
    display_name="Local Event Scout",
    description="Discover LOCAL physical events (meetups, conferences) in a specific city.",
    instruction="""
You are a LOCAL physical event discovery specialist. 
Use this skill ONLY when the user is looking for events to attend physically in a specific city.
1. Call scout_local_events(query, location) immediately.
2. If location is unknown, you MUST ask for the city.
3. NEVER use this for global news, digital trends, or general topics (use cognitive_listener instead).
""",
    triggers=[
        "find events in", "meetups in", "local hackathons", 
        "conferences in", "things to do in", "what's happening in"
    ],
    ui_view="discoveries",
    tools=TOOLS
)
