import asyncio
from typing import List, Dict, Any
from .eventbrite import EventbriteClient
from .meetup_scraper import MeetupScraper
from .luma_scraper import LumaScraper
from .tavily_search import TavilyDiscovery

class EventDiscoveryService:
    def __init__(self, eventbrite_key: str = None, tavily_key: str = None):
        self.eventbrite = EventbriteClient(api_key=eventbrite_key)
        self.meetup = MeetupScraper()
        self.luma = LumaScraper()
        self.tavily = TavilyDiscovery(api_key=tavily_key)

    async def discover(self, interests: List[str], location: str = "") -> List[Dict[str, Any]]:
        """
        Aggregate event discovery across multiple sources with tiered search and balancing.
        """
        # 1. Targeted Provider Search
        tasks = [
            self.eventbrite.search_events(interests),
            self.meetup.search_events(interests, location),
            self.luma.search_events(interests, location),
            self.tavily.search_events(interests, location)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 2. Extract results and identify empty sources for intelligent retry
        sources = ["eventbrite", "meetup", "luma", "web_search"]
        source_results = {s: [] for s in sources}
        for idx, res in enumerate(results):
            if isinstance(res, list) and len(res) > 0:
                source_results[sources[idx]] = res

        # 3. Targeted Retry for Primary Providers
        if len(interests) > 1:
            retry_tasks = []
            retry_map = []
            
            for provider in ["eventbrite", "meetup", "luma"]:
                if not source_results[provider]:
                    # Retry with just the top primary interest
                    if provider == "eventbrite":
                        retry_tasks.append(self.eventbrite.search_events([interests[0]]))
                    elif provider == "meetup":
                        retry_tasks.append(self.meetup.search_events([interests[0]], location))
                    elif provider == "luma":
                        retry_tasks.append(self.luma.search_events([interests[0]], location))
                    retry_map.append(provider)

            if retry_tasks:
                retries = await asyncio.gather(*retry_tasks, return_exceptions=True)
                for idx, res in enumerate(retries):
                    if isinstance(res, list):
                        source_results[retry_map[idx]].extend(res)

        # 4. Combine all results
        all_events = []
        for res in source_results.values():
            all_events.extend(res)

        # Smarter Deduplication and Balancing
        source_buckets = {}
        for event in all_events:
            source = event.get("source", "unknown")
            if source not in source_buckets:
                source_buckets[source] = []
            
            # Simple title-based duplicate check within the bucket aggregation
            title_norm = event.get("title", "").lower().strip()
            is_dup = any(title_norm == e.get("title", "").lower().strip() for e in source_buckets[source])
            if not is_dup:
                source_buckets[source].append(event)

        # Balanced picking (Round-Robin)
        balanced_results = []
        sources = list(source_buckets.keys())
        if not sources:
            return []

        # Interleave results from different sources
        max_len = max(len(bucket) for bucket in source_buckets.values())
        for i in range(max_len):
            for source in sources:
                if i < len(source_buckets[source]):
                    balanced_results.append(source_buckets[source][i])

        return balanced_results
