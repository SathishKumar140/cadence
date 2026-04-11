import httpx
from bs4 import BeautifulSoup
import json
from typing import List, Dict, Any

class MeetupScraper:
    """
    Scraper for public Meetup events.
    """
    BASE_URL = "https://www.meetup.com/find/"

    async def search_events(self, keywords: List[str], location: str = "") -> List[Dict[str, Any]]:
        """
        Scrape public Meetup event listings.
        """
        params = {
            "keywords": " ".join(keywords),
            "source": "EVENTS",
            "location": location
        }
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.get(self.BASE_URL, params=params, headers=headers)
                if response.status_code != 200:
                    return []

                soup = BeautifulSoup(response.text, 'lxml')
                events = []
                
                # Meetup often stores event data in JSON-LD or specific card classes
                # We'll look for both. JSON-LD is more reliable if present.
                json_ld = soup.find_all('script', type='application/ld+json')
                for script in json_ld:
                    try:
                        data = json.loads(script.string)
                        if isinstance(data, list):
                            for item in data:
                                if item.get("@type") == "Event":
                                    events.append(self._parse_ld(item))
                        elif data.get("@type") == "Event":
                            events.append(self._parse_ld(data))
                    except:
                        continue
                
                if not events:
                    # Fallback to card parsing if JSON-LD isn't there or is empty
                    cards = soup.select('[data-testid="event-card"]')
                    for card in cards:
                        try:
                            title_el = card.select_one('[data-testid="event-card-title"]')
                            title = title_el.text.strip() if title_el else "Meetup Event"
                            link = card.find('a')['href'] if card.find('a') else ""
                            if link and not link.startswith('http'):
                                link = f"https://www.meetup.com{link}"
                            
                            events.append({
                                "title": title,
                                "description": "Meetup event detected via discovery.",
                                "url": link,
                                "source": "meetup"
                            })
                        except:
                            continue

                return events
            except Exception as e:
                print(f"Meetup Scraper Error: {e}")
                return []

    def _parse_ld(self, item: Dict) -> Dict:
        return {
            "title": item.get("name", "Meetup Event"),
            "description": item.get("description", ""),
            "start_time": item.get("startDate"),
            "end_time": item.get("endDate"),
            "url": item.get("url"),
            "location": item.get("location", {}).get("name", "Remote/TBD"),
            "source": "meetup"
        }
