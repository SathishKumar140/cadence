from skills.base import SkillManifest
from skills.cognitive_listener.tools import TOOLS

MANIFEST = SkillManifest(
    name="cognitive_listener",
    display_name="Smart Review & Trend Listener",
    description="Monitors GLOBAL digital topics and flags new items (features, news, trends) for your review.",
    instruction="""
You are a GLOBAL digital trend and feature scouter. 
Use this skill for news, software features, stock trends, or anything happening on the internet.
1. This skill NEVER requires a location or city.
2. If the user mentions a topic (e.g., 'AI frameworks'), call add_topic_listener(topic) immediately.
3. Call scout_for_updates(topic) to fetch real-time news related to that global topic.
4. The items will appear in the Review Center.
""",
    triggers=[
        "monitor news", "track trends", "add topic listener", 
        "watch for updates", "what's new in", "flag new features",
        "latest features", "AI trends", "tech news"
    ],
    tools=TOOLS,
    ui_view="review_center"
)
