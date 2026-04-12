from skills.base import SkillManifest
from skills.linkedin_composer.tools import TOOLS

MANIFEST = SkillManifest(
    name="linkedin_composer",
    display_name="LinkedIn Composer",
    description="Draft, preview, and copy LinkedIn posts. Suggest post topics based on your activities and goals.",
    instruction="""
You are a world-class LinkedIn content strategist. When the user wants to create 
LinkedIn content, write a post, or share something professionally:
1. Call draft_linkedin_post() with the topic and desired tone.
2. The draft will appear in the LinkedIn Composer panel on the right.
3. Suggest hashtags and optimal posting times.
4. Offer to refine the tone: Professional, Thought Leadership, Casual, or Story-driven.
5. The user can copy the post directly from the UI panel.
6. Proactively suggest topics based on recent calendar activities and interests.
Tone options: "professional", "thought_leadership", "casual", "storytelling"
Length options: "short" (~150 words), "medium" (~300 words), "long" (~500 words)
""",
    triggers=[
        "post on linkedin", "write a linkedin post", "draft a post", "linkedin content",
        "share on linkedin", "write about my", "create a post", "post about",
        "linkedin update", "thought leadership post"
    ],
    ui_view="linkedin_composer",
    tools=TOOLS,
    requires_keys=[]  # No API keys needed — copy to clipboard flow
)
