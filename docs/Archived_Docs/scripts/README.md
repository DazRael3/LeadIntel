# Lead Intelligence Scraper

Python-based web scraper for monitoring B2B news sources and detecting trigger events.

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Install Playwright browsers:
```bash
python -m playwright install chromium
```

3. Create `.env` file in `scripts/` directory:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key
```

## Usage

Run the scraper:
```bash
python scraper.py
```

## Automation

Set up a cron job or use n8n to run this script periodically:

**Windows Task Scheduler:**
- Create a task that runs `python C:\path\to\scripts\scraper.py` daily

**n8n Workflow:**
- Use HTTP Request node to trigger the script
- Or use Execute Command node to run Python script

## Customization

Edit `NEWS_SOURCES` and `TRIGGER_KEYWORDS` in `scraper.py` to add more sources or event types.
