import asyncio
from playwright.async_api import async_playwright

async def main():
    print("Launching Chromium...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            executable_path='/usr/bin/google-chrome',
            args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
        )
        context = await browser.new_context(
            viewport={'width': 1440, 'height': 900},
            device_scale_factor=2
        )
        page = await context.new_page()

        print("Navigating to http://localhost:3000...")
        await page.goto("http://localhost:3000")
        await page.wait_for_selector('input[type="email"]')

        # Login
        print("Logging in as admin...")
        await page.fill('input[type="email"]', 'omchoksi99@gmail.com')
        await page.fill('input[type="password"]', 'OMchoksi')
        await page.click('button:has-text("Sign In")')
        await page.wait_for_timeout(2500)

        # 1. Market Overview
        print("Capturing 1. Market Overview...")
        await page.click('button:has-text("Market Watchlist")')
        await page.wait_for_timeout(2000)
        await page.screenshot(path="docs/images/market_overview.png")

        # 2. Option Chain
        print("Capturing 2. Option Chain...")
        await page.click('button:has-text("Option Chain")')
        await page.wait_for_timeout(2000)
        await page.screenshot(path="docs/images/option_chain.png")

        # 3. Backtesting Lab
        print("Capturing 3. Backtesting Lab...")
        await page.click('button:has-text("Backtesting Lab")')
        await page.wait_for_timeout(2000)
        await page.screenshot(path="docs/images/backtesting_lab.png")

        # 4. Encrypted Broker Connection
        print("Capturing 4. Broker Settings...")
        await page.click('button:has-text("Broker")')
        await page.wait_for_timeout(2000)
        await page.screenshot(path="docs/images/broker_connect.png")

        # 5. Trade Execution Ticket
        print("Capturing 5. Trading Ticket...")
        await page.click('button:has-text("Trading Ticket")')
        await page.wait_for_timeout(2000)
        await page.screenshot(path="docs/images/trader_ticket.png")

        print("Done capturing all screenshots!")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
