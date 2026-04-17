from typing import Optional, List, Dict
from loguru import logger
from .fast_parser import parse_m3u_fast
from .providers import get_all_provider_urls

def dedup_channels(channels: List[Dict]) -> List[Dict]:
    seen = set()
    unique = []
    for ch in channels:
        key = ch.get("name", "").lower().strip()
        if key and key not in seen:
            seen.add(key)
            unique.append(ch)
    return unique

async def aggregate_all_sources(
    extra_m3u_urls: Optional[List[str]] = None,
    xtream_config: Optional[Dict] = None,
) -> List[Dict]:
    all_channels = []
    
    # 1. المصادر من .env
    for url in get_all_provider_urls():
        try:
            channels = await parse_m3u_fast(url)
            all_channels.extend(channels)
            logger.info(f"Loaded {len(channels)} from {url[:80]}...")
        except Exception as e:
            logger.error(f"Failed {url}: {e}")
    
    # 2. مصادر إضافية من المستخدم
    if extra_m3u_urls:
        for url in extra_m3u_urls:
            try:
                channels = await parse_m3u_fast(url)
                all_channels.extend(channels)
            except Exception as e:
                logger.error(f"Failed extra {url}: {e}")
    
    # 3. Xtream (اختياري)
    if xtream_config:
        # افترض وجود دالة fetch_xtream_channels
        from .xtream_client import fetch_xtream_channels
        try:
            channels = await fetch_xtream_channels(xtream_config)
            all_channels.extend(channels)
        except Exception as e:
            logger.error(f"Failed Xtream: {e}")
    
    return dedup_channels(all_channels)

from typing import Any, Optional
import time

class SimpleCache:
    def __init__(self):
        self.data = {}

    async def get(self, key: str) -> Optional[Any]:
        item = self.data.get(key)
        if item:
            if item['expiry'] is None or item['expiry'] > time.time():
                return item['value']
            else:
                del self.data[key]
        return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None):
        expiry = time.time() + ttl if ttl else None
        self.data[key] = {'value': value, 'expiry': expiry}

channel_cache = SimpleCache()
stream_cache = SimpleCache()

import re
from typing import List, Dict

def smart_category(name: str) -> str:
    name_lower = name.lower()
    
    # رياضة
    if any(x in name_lower for x in ["bein", "sport", "espn", "sky sport", "football", "basketball", "tennis"]):
        return "Sports"
    # أفلام
    if any(x in name_lower for x in ["movie", "cinema", "film", "hbo", "netflix", "prime"]):
        return "Movies"
    # أطفال
    if any(x in name_lower for x in ["kids", "cartoon", "disney", "nickelodeon", "baby"]):
        return "Kids"
    # أخبار
    if any(x in name_lower for x in ["news", "cnn", "bbc", "fox news", "sky news", "aljazeera"]):
        return "News"
    # عربية
    if any(x in name_lower for x in ["arab", "ksa", "egy", "dubai", "mbc", "rotana", "dubai", "abu dhabi"]):
        return "Arabic"
    return "General"

def clean_channels(raw_channels: List[Dict]) -> List[Dict]:
    """
    تنظيف القنوات: إزالة البيانات الفارغة، إعادة التصنيف، تعيين معرف فريد.
    """
    cleaned = []
    for idx, ch in enumerate(raw_channels):
        name = ch.get("name", "").strip()
        if not name:
            continue
        
        # إزالة الأحرف غير المرغوب فيها من الاسم
        name = re.sub(r'[^\w\s\u0600-\u06FF\-]', '', name)
        
        cleaned.append({
            "id": idx + 1,
            "name": name,
            "category": smart_category(name),
            "logo": ch.get("logo", ""),
            "streams": ch.get("streams", []),
            "source": ch.get("source", ""),
            "alive": False,      # يتم تحديثها عند الطلب
            "best_stream": None,
            "backup_streams": [],
            "score": 0
        })
    return cleaned

import aiohttp
import re
from typing import List, Dict

async def parse_m3u_fast(url: str) -> List[Dict]:
    """
    تحليل M3U سريع جداً باستخدام regex.
    """
    channels = []
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=10) as response:
                if response.status != 200:
                    return []
                content = await response.text()
                
                # Regex patterns for M3U parsing
                # This matches #EXTINF lines and the following URL
                pattern = re.compile(r'#EXTINF:.*?,(.*?)\n(http.*?)(?=\n#EXTINF|$)', re.DOTALL)
                matches = pattern.findall(content)
                
                for name, stream_url in matches:
                    channels.append({
                        "name": name.strip(),
                        "streams": [stream_url.strip()],
                        "logo": "", # Can be enhanced to extract tvg-logo
                        "source": url
                    })
    except Exception:
        pass
    return channels

import os
from dotenv import load_dotenv

load_dotenv()

def get_all_provider_urls() -> list[str]:
    urls = []
    i = 1
    while True:
        url = os.getenv(f"PROVIDER_{i}_URL")
        if not url:
            break
        urls.append(url)
        i += 1
    return urls

from typing import List, Dict

async def fetch_xtream_channels(config: Dict) -> List[Dict]:
    """
    Placeholder for Xtream API client.
    """
    # In a real implementation, this would use the host, username, and password
    # to fetch channels from the Xtream Codes API.
    return []

# IPTV MindApp Engine
