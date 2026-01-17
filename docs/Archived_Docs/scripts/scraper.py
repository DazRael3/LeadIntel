"""
B2B Lead Intelligence Scraper
Monitors news wires and business sources for trigger events
"""

import asyncio
import json
import os
from datetime import datetime
from typing import List, Dict, Optional
from playwright.async_api import async_playwright, Browser, Page
from supabase import create_client, Client
import openai

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# News sources to monitor
NEWS_SOURCES = [
    {
        "name": "TechCrunch",
        "url": "https://techcrunch.com",
        "selectors": {
            "articles": "article.post-block",
            "title": "h2.post-block__title a",
            "link": "h2.post-block__title a",
            "excerpt": ".post-block__content"
        }
    },
    {
        "name": "Crunchbase News",
        "url": "https://news.crunchbase.com",
        "selectors": {
            "articles": "article",
            "title": "h2 a",
            "link": "h2 a",
            "excerpt": ".excerpt"
        }
    }
]

# Keywords to identify trigger events
TRIGGER_KEYWORDS = {
    "funding": ["funding", "raised", "series", "investment", "venture capital", "seed round"],
    "new_hires": ["hired", "appointed", "joins", "new executive", "c-suite"],
    "expansion": ["expanding", "new office", "entering", "launching in", "international"],
    "product_launch": ["launched", "unveils", "announces", "new product", "release"],
    "partnership": ["partnership", "partners with", "collaboration", "teams up"]
}


class LeadScraper:
    def __init__(self):
        self.supabase: Optional[Client] = None
        if SUPABASE_URL and SUPABASE_KEY:
            self.supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.openai_client = openai.OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

    async def scrape_source(self, source: Dict, browser: Browser) -> List[Dict]:
        """Scrape a single news source for articles"""
        page = await browser.new_page()
        articles = []

        try:
            print(f"Scraping {source['name']}...")
            await page.goto(source['url'], wait_until="networkidle")
            await page.wait_for_selector(source['selectors']['articles'], timeout=10000)

            article_elements = await page.query_selector_all(source['selectors']['articles'])

            for element in article_elements[:10]:  # Limit to 10 most recent
                try:
                    title_elem = await element.query_selector(source['selectors']['title'])
                    if not title_elem:
                        continue

                    title = await title_elem.inner_text()
                    link = await title_elem.get_attribute('href')
                    
                    if not link.startswith('http'):
                        link = source['url'] + link

                    excerpt_elem = await element.query_selector(source['selectors'].get('excerpt', ''))
                    excerpt = await excerpt_elem.inner_text() if excerpt_elem else ""

                    # Check if article contains trigger keywords
                    event_type = self.detect_trigger_event(title + " " + excerpt)
                    
                    if event_type:
                        # Extract company name using AI
                        company_name = await self.extract_company_name(title, excerpt)
                        
                        articles.append({
                            "title": title.strip(),
                            "link": link,
                            "excerpt": excerpt.strip(),
                            "event_type": event_type,
                            "company_name": company_name,
                            "source": source['name']
                        })
                except Exception as e:
                    print(f"Error processing article: {e}")
                    continue

        except Exception as e:
            print(f"Error scraping {source['name']}: {e}")
        finally:
            await page.close()

        return articles

    def detect_trigger_event(self, text: str) -> Optional[str]:
        """Detect trigger event type from text"""
        text_lower = text.lower()
        
        for event_type, keywords in TRIGGER_KEYWORDS.items():
            if any(keyword in text_lower for keyword in keywords):
                return event_type
        
        return None

    async def extract_company_name(self, title: str, excerpt: str) -> str:
        """Extract company name using OpenAI"""
        if not self.openai_client:
            # Fallback: simple extraction
            words = title.split()
            return " ".join(words[:3]) if len(words) > 3 else title[:50]

        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "Extract the company name from the following news article. Return only the company name, nothing else."
                    },
                    {
                        "role": "user",
                        "content": f"Title: {title}\n\nExcerpt: {excerpt[:200]}"
                    }
                ],
                temperature=0.3,
                max_tokens=50
            )
            
            company_name = response.choices[0].message.content.strip()
            return company_name
        except Exception as e:
            print(f"Error extracting company name: {e}")
            return title.split()[0] if title else "Unknown Company"

    async def save_events(self, events: List[Dict]):
        """Save trigger events to Supabase"""
        if not self.supabase:
            print("Supabase not configured. Events not saved.")
            return

        for event in events:
            try:
                # Check if event already exists
                existing = self.supabase.table('trigger_events')\
                    .select('id')\
                    .eq('source_url', event['link'])\
                    .execute()

                if existing.data and len(existing.data) > 0:
                    continue  # Skip duplicates

                # Insert new event
                self.supabase.table('trigger_events').insert({
                    "company_name": event['company_name'],
                    "event_type": event['event_type'],
                    "event_description": f"{event['title']}\n\n{event['excerpt']}",
                    "source_url": event['link'],
                    "detected_at": datetime.utcnow().isoformat(),
                    "company_url": self.extract_company_url(event['link'])
                }).execute()

                print(f"Saved event: {event['company_name']} - {event['event_type']}")
            except Exception as e:
                print(f"Error saving event: {e}")

    def extract_company_url(self, article_url: str) -> Optional[str]:
        """Extract company URL from article (simplified)"""
        # In production, you'd parse the article to find company website
        return None

    async def run(self):
        """Main scraper execution"""
        print("Starting B2B Lead Intelligence Scraper...")
        
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            
            all_events = []
            
            for source in NEWS_SOURCES:
                events = await self.scrape_source(source, browser)
                all_events.extend(events)
                await asyncio.sleep(2)  # Rate limiting

            await browser.close()

            print(f"\nFound {len(all_events)} trigger events")
            
            if all_events:
                await self.save_events(all_events)
                print("Events saved to database")
            else:
                print("No trigger events found")

            return all_events


async def main():
    scraper = LeadScraper()
    await scraper.run()


if __name__ == "__main__":
    asyncio.run(main())
