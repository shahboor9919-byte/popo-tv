let allChannels = [];
let favorites = JSON.parse(localStorage.getItem("fav") || "[]");

function getLogoUrl(channelName) {
    const name = channelName.toLowerCase();
    if (name.includes("bein")) return "https://upload.wikimedia.org/wikipedia/commons/9/9b/BeIN_Sports_logo.png";
    if (name.includes("mbc")) return "https://upload.wikimedia.org/wikipedia/commons/5/59/MBC_Logo.png";
    if (name.includes("bbc")) return "https://upload.wikimedia.org/wikipedia/commons/b/bc/BBC_logo.svg";
    if (name.includes("cnn")) return "https://upload.wikimedia.org/wikipedia/commons/b/b1/CNN.svg";
    if (name.includes("pluto")) return "https://pluto.tv/favicon.ico";
    if (name.includes("samsung")) return "https://www.samsung.com/etc/designs/samsung/static/favicon.ico";
    return "https://via.placeholder.com/300x180?text=TV";
}

function groupByCategory(channels) {
    const groups = {};
    channels.forEach(ch => {
        const cat = ch.category || "General";
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(ch);
    });
    return groups;
}

function renderRows(channels) {
    const rowsDiv = document.getElementById("rows");
    const groups = groupByCategory(channels);
    let html = "";

    if (favorites.length > 0) {
        const favChannels = channels.filter(c => favorites.includes(c.name));
        if (favChannels.length) {
            html += `<div class="row"><h2>⭐ المفضلات</h2><div class="row-items">`;
            favChannels.slice(0, 25).forEach(ch => {
                html += `
                    <div class="card" data-url="${ch.streams?.[0] || ''}" data-name="${ch.name}">
                        <img src="${getLogoUrl(ch.name)}" onerror="this.src='https://via.placeholder.com/300x180'">
                        <div class="title">${ch.name}</div>
                        <button class="fav-btn" onclick="toggleFav('${ch.name.replace(/'/g, "\\'")}', event)">⭐</button>
                    </div>
                `;
            });
            html += `</div></div>`;
        }
    }

    for (const [cat, chs] of Object.entries(groups)) {
        if (chs.length === 0) continue;
        html += `<div class="row"><h2>${cat}</h2><div class="row-items">`;
        chs.slice(0, 25).forEach(ch => {
            html += `
                <div class="card" data-url="${ch.streams?.[0] || ''}" data-name="${ch.name}">
                    <img src="${getLogoUrl(ch.name)}" onerror="this.src='https://via.placeholder.com/300x180'">
                    <div class="title">${ch.name}</div>
                    <button class="fav-btn" onclick="toggleFav('${ch.name.replace(/'/g, "\\'")}', event)">⭐</button>
                </div>
            `;
        });
        html += `</div></div>`;
    }
    rowsDiv.innerHTML = html;

    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('fav-btn')) return;
            const url = card.dataset.url;
            if (url) playChannel(url);
        });
    });
}

let currentFallbackList = [];
let fallbackIndex = 0;

function playChannel(url) {
    const video = document.getElementById("player");
    if (!url) return alert("لا يوجد رابط للقناة");
    fetch(`/watch/${getChannelIdFromUrl(url)}`)
        .then(res => res.json())
        .then(data => {
            currentFallbackList = [data.stream_url, ...(data.backups || [])];
            fallbackIndex = 0;
            tryPlayStream(currentFallbackList[0]);
        })
        .catch(() => {
            currentFallbackList = [url];
            fallbackIndex = 0;
            tryPlayStream(url);
        });
}

function tryPlayStream(streamUrl) {
    const video = document.getElementById("player");
    if (!streamUrl) {
        alert("فشلت جميع المحاولات");
        return;
    }
    if (streamUrl.includes(".m3u8") && Hls.isSupported()) {
        if (window.hls) window.hls.destroy();
        const hls = new Hls();
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        window.hls = hls;
        hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) {
                fallbackIndex++;
                tryPlayStream(currentFallbackList[fallbackIndex]);
            }
        });
    } else {
        video.src = streamUrl;
        video.play().catch(() => {
            fallbackIndex++;
            tryPlayStream(currentFallbackList[fallbackIndex]);
        });
    }
    video.onerror = () => {
        fallbackIndex++;
        tryPlayStream(currentFallbackList[fallbackIndex]);
    };
}

function getChannelIdFromUrl(url) {
    const ch = allChannels.find(c => c.streams && c.streams[0] === url);
    return ch ? ch.id : 1;
}

function toggleFav(name, event) {
    event.stopPropagation();
    if (favorites.includes(name)) {
        favorites = favorites.filter(f => f !== name);
    } else {
        favorites.push(name);
    }
    localStorage.setItem("fav", JSON.stringify(favorites));
    renderRows(allChannels);
}

function filterChannels(searchTerm) {
    if (!searchTerm) return renderRows(allChannels);
    const filtered = allChannels.filter(ch => ch.name.toLowerCase().includes(searchTerm.toLowerCase()));
    renderRows(filtered);
}

async function loadChannels() {
    try {
        const res = await fetch("/channels?alive_only=false&limit=5000");
        const data = await res.json();
        allChannels = data.channels;
        renderRows(allChannels);
    } catch (err) {
        console.error(err);
        document.getElementById("rows").innerHTML = "<p>فشل تحميل القنوات</p>";
    }
}

document.getElementById("search").addEventListener("input", (e) => filterChannels(e.target.value));
loadChannels();
body {
    background: #0f0f0f;
    color: #fff;
    font-family: 'Segoe UI', Roboto, sans-serif;
    margin: 0;
    padding: 0;
}
.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 30px;
    background: #000000cc;
    backdrop-filter: blur(10px);
    position: sticky;
    top: 0;
    z-index: 100;
}
.header h1 {
    font-size: 1.6rem;
    margin: 0;
}
#search {
    padding: 8px 15px;
    border-radius: 30px;
    border: none;
    width: 250px;
    font-size: 1rem;
}
#player {
    width: 100%;
    max-height: 500px;
    background: black;
}
.row {
    margin: 25px 20px;
}
.row h2 {
    margin-left: 10px;
    font-size: 1.5rem;
    font-weight: 500;
}
.row-items {
    display: flex;
    overflow-x: auto;
    gap: 12px;
    padding: 10px 5px;
    scrollbar-width: thin;
}
.card {
    min-width: 200px;
    background: #1e1e1e;
    border-radius: 12px;
    overflow: hidden;
    transition: transform 0.2s, box-shadow 0.2s;
    cursor: pointer;
}
.card:hover {
    transform: scale(1.05);
    box-shadow: 0 8px 20px rgba(0,0,0,0.5);
}
.card img {
    width: 100%;
    height: 120px;
    object-fit: cover;
    background: #2a2a2a;
}
.title {
    padding: 10px;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.fav-btn {
    background: none;
    border: none;
    color: gold;
    font-size: 18px;
    cursor: pointer;
    margin: 5px;
}
<!DOCTYPE html>
<html lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IPTV Mind Pro</title>
    <link rel="stylesheet" href="/static/style.css">
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
</head>
<body>
    <div class="header">
        <h1>🎬 IPTV Mind Pro</h1>
        <input type="text" id="search" placeholder="ابحث عن قناة..." autocomplete="off">
    </div>
    <video id="player" controls autoplay></video>
    <div id="rows"></div>
    <script src="/static/app.js"></script>
</body>
</html>
