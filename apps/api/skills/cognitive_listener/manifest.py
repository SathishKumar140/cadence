from skills.base import SkillManifest
from skills.cognitive_listener.tools import TOOLS

MANIFEST = SkillManifest(
    name="cognitive_listener",
    display_name="Smart Review & Trend Listener",
    description="Monitors specific topics and flags new items (features, news, trends) for your manual review.",
    tools=TOOLS,
    ui_view="review_center"
)
