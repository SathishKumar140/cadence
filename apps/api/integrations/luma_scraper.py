import httpx
from bs4 import BeautifulSoup
from typing import List, Dict, Any
import json

class LumaScraper:
    """
    Scraper for Luma city pages using Next.js state parsing.
    """
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

    async def search_events(self, keywords: List[str], location: str = "singapore") -> List[Dict[str, Any]]:
        """
        Scrape events from luma.com city pages (e.g. luma.com/singapore).
        """
        city_slug = location.lower().replace(" ", "-") if location else "singapore"
        url = f"https://luma.com/{city_slug}"
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url, headers=self.headers, follow_redirects=True)
                if response.status_code != 200:
                    return []

                soup = BeautifulSoup(response.text, 'html.parser')
                next_data_script = soup.find('script', id='__NEXT_DATA__')
                if not next_data_script:
                    return []

                data = json.loads(next_data_script.string)
                props = data.get("props", {}).get("pageProps", {})
                
                # Precise mapping for city-specific pages discovered via audit
                initial_data = props.get("initialData", {}).get("data", {})
                events_list = []
                if isinstance(initial_data, dict):
                    events_list = initial_data.get("events", []) or initial_data.get("featured_events", [])
                
                if not events_list and "results" in initial_data:
                    events_list = initial_data.get("results", [])

                events_data = []
                for ev in events_list:
                    # Sometimes events are nested in an 'event' key
                    e_obj = ev.get("event", ev)
                    if not isinstance(e_obj, dict): continue
                    
                    title = e_obj.get("name", "")
                    desc = e_obj.get("description", "") or ""
                    
                    # Interest matching (Intelligent broad search)
                    text = (title + " " + desc).lower()
                    
                    # LOGIC: If the user is asking for "events" or "local" things, 
                    # they want to see what's trending, not just items with that word.
                    is_broad_search = any(k.lower() in ["event", "events", "local", "nearby", "scout"] for k in keywords)
                    
                    if not keywords or is_broad_search or any(k.lower() in text for k in keywords):
                        events_data.append({
                            "title": title,
                            "description": desc[:200] + "..." if len(desc) > 200 else desc,
                            "start_time": e_obj.get("start_at", ""),
                            "url": f"https://lu.ma/{e_obj.get('url_slug', '')}",
                            "location": e_obj.get("geo_address_json", {}).get("city", location),
                            "source": "luma"
                        })

                return events_data
        except Exception as e:
            print(f"Luma Scraper Error: {str(e)}")
            return []
