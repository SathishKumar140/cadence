from dataclasses import dataclass, field
from typing import List, Any, Callable


@dataclass
class SkillManifest:
    """
    The descriptor for a Cadence skill.
    Each skill directory must expose a MANIFEST instance of this class.
    """
    name: str                          # Unique snake_case identifier: "linkedin_composer"
    display_name: str                  # Human label: "LinkedIn Composer"
    description: str                   # One-line capability summary (used in system prompt overview)
    instruction: str                   # Detailed LLM instruction block for this skill
    triggers: List[str]               # Example user intents that map to this skill
    ui_view: str                       # Frontend view key: "linkedin_composer", "time_slots", etc.
    tools: List[Any] = field(default_factory=list)          # LangChain tool functions
    requires_keys: List[str] = field(default_factory=list)  # Env vars needed (for graceful degrade)
    is_default: bool = False           # True for the fallback/homepage skill (schedule_manager)

    def is_available(self) -> bool:
        """Returns True if all required env vars are present."""
        import os
        return all(os.getenv(k) for k in self.requires_keys)

    def to_system_prompt_block(self) -> str:
        """Formats this skill as a block for the master system prompt."""
        return (
            f"### Skill: {self.display_name} (ui_view='{self.ui_view}')\n"
            f"{self.instruction}\n"
            f"Example triggers: {', '.join(self.triggers[:3])}"
        )
