import os
from tavily import TavilyClient
from typing import List, Dict, Any

class TavilyDiscovery:
    def __init__(self, api_key: str = None):
        key = api_key or os.getenv("TAVILY_API_KEY")
        if not key or "placeholder" in key:
            self.client = None
        else:
            self.client = TavilyClient(api_key=key)

    async def search_events(self, keywords: List[str], location: str = "Singapore") -> List[Dict[str, Any]]:
        """
        Search for events across the web using Tavily.
        """
        if not self.client:
            return []

        query = f"upcoming events, festivals, workshops in {location} " + " ".join(keywords)
        
        try:
            # Tavily search is synchronous in their basic SDK, but we wrap it
            # Perform search with a focus on 'news/events' style results
            response = self.client.search(
                query=query,
                search_depth="advanced",
                max_results=10
            )
            
            results = response.get("results", [])
            events = []
            for res in results:
                # Basic enrichment/validation - tavily results have title, url, content
                events.append({
                    "title": res.get("title", ""),
                    "description": res.get("content", ""),
                    "url": res.get("url", ""),
                    "date": "", # Tavily doesn't have structured dates in the same way
                    "location": location,
                    "source": "web_search"
                })
            
            return events
        except Exception as e:
            print(f"Tavily Search Error: {str(e)}")
            return []

    async def search_trends(self, topic: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """
        Perform a broad search for news, features, and trends related to a topic.
        """
        if not self.client:
            return []

        query = f"latest news, features, updates, and trends in {topic} 2024 2025"
        
        try:
            response = self.client.search(
                query=query,
                search_depth="advanced",
                max_results=max_results
            )
            
            results = response.get("results", [])
            trends = []
            for res in results:
                trends.append({
                    "title": res.get("title", ""),
                    "description": res.get("content", ""),
                    "url": res.get("url", ""),
                    "source": "tavily_news"
                })
            
            return trends
        except Exception as e:
            print(f"Tavily Trend Search Error: {str(e)}")
            return []
