// تنظیمات ظاهری نقشه
const STROKE_COLOR = '#333';
const FILL_COLOR = '#222';
const ACTIVE_COLOR = '#00d2ff';
const HOVER_OFFSET = -15; // مقدار بالا آمدن کشور (پیکسل)

const canvas = document.getElementById('worldCanvas');
const ctx = canvas.getContext('2d');
const countryLabel = document.getElementById('country-label');
const statusEl = document.getElementById('status');

// ایجاد بوم مخفی برای تشخیص برخورد (Hit Detection)
const hitCanvas = document.createElement('canvas');
const hitCtx = hitCanvas.getContext('2d', { willReadFrequently: true });

let width, height;
let geoDataGlobal;
let pathGenerator;
let projection;

let currentHoverIndex = -1;
let hoverState = { offset: 0, colorRatio: 0 }; 

// تنظیم ابعاد بوم‌ها بر اساس اندازه پنجره
function updateDimensions() {
    width = Math.floor(window.innerWidth * 0.95) || 800;
    height = Math.floor(window.innerHeight * 0.9) || 600;
    
    canvas.width = width;
    canvas.height = height;
    
    hitCanvas.width = width;
    hitCanvas.height = height;
}
updateDimensions();

// بررسی لود شدن کتابخانه‌ها
if (typeof d3 === 'undefined' || typeof anime === 'undefined') {
    statusEl.className = 'status-msg error';
    statusEl.innerHTML = 'خطا در لود کتابخانه‌ها (D3 یا Anime.js).';
} else {
    // دریافت داده‌های نقشه جهان (GeoJSON)
    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
        .then(res => res.json())
        .then(data => {
            // حذف قطب جنوب (ATA) برای زیبایی بیشتر
            data.features = data.features.filter(d => d.id !== 'ATA');
            geoDataGlobal = data;
            
            statusEl.style.display = 'none';
            initMap();
        })
        .catch(err => {
            console.error(err);
            statusEl.className = 'status-msg error';
            statusEl.innerHTML = 'خطا در دریافت اطلاعات نقشه.';
        });
}

// واکنش به تغییر اندازه صفحه
window.addEventListener('resize', () => {
    updateDimensions();
    if (geoDataGlobal) initMap();
});

// راه‌اندازی اولیه نقشه
function initMap() {
    if (!width || !height) return;

    // تنظیم پروجکشن (تبدیل کره به صفحه تخت)
    projection = d3.geoMercator().fitSize([width, height], geoDataGlobal);
    pathGenerator = d3.geoPath().projection(projection);

    renderHitCanvas();
    draw();
}

// رسم نقشه رنگی در بوم مخفی برای تشخیص موس
function renderHitCanvas() {
    hitCtx.clearRect(0, 0, width, height);
    
    geoDataGlobal.features.forEach((feature, index) => {
        hitCtx.beginPath();
        pathGenerator.context(hitCtx)(feature);
        
        // تبدیل ایندکس به رنگ RGB یکتا
        const id = index + 1;
        const r = (id >> 16) & 255;
        const g = (id >> 8) & 255;
        const b = id & 255;
        
        hitCtx.fillStyle = `rgb(${r},${g},${b})`;
        hitCtx.fill();
    });
}

// تابع اصلی رسم نقشه روی صفحه
function draw() {
    ctx.clearRect(0, 0, width, height);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 1. رسم لایه پایینی (همه کشورها به جز کشور انتخاب شده)
    geoDataGlobal.features.forEach((feature, index) => {
        if (index === currentHoverIndex) return;

        ctx.beginPath();
        pathGenerator.context(ctx)(feature);
        
        ctx.fillStyle = FILL_COLOR;
        ctx.strokeStyle = STROKE_COLOR;
        ctx.lineWidth = 0.5;
        
        ctx.fill();
        ctx.stroke();
    });

    // 2. رسم لایه بالایی (فقط کشور انتخاب شده)
    if (currentHoverIndex !== -1) {
        const feature = geoDataGlobal.features[currentHoverIndex];
        
        ctx.save();
        
        // محاسبه سایه بر اساس ارتفاع
        const shadowDist = Math.abs(hoverState.offset) * 1.5; 
        
        ctx.shadowColor = 'black';
        ctx.shadowBlur = shadowDist + 5; 
        ctx.shadowOffsetY = shadowDist; 
        
        // انتقال به بالا (انیمیشن)
        ctx.translate(0, hoverState.offset);
        
        ctx.beginPath();
        pathGenerator.context(ctx)(feature);
        
        ctx.fillStyle = ACTIVE_COLOR;
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
    }
}

// مدیریت انیمیشن هاور
function animateHover(targetOffset) {
    anime.remove(hoverState);
    
    anime({
        targets: hoverState,
        offset: targetOffset,
        easing: 'easeOutCubic', // حرکت نرم
        duration: 600,
        update: draw
    });
}

// رویداد حرکت موس
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // خواندن رنگ پیکسل زیر موس از بوم مخفی
    const pixel = hitCtx.getImageData(x, y, 1, 1).data;
    const index = ((pixel[0] << 16) | (pixel[1] << 8) | pixel[2]) - 1;

    // اگر موس روی یک کشور است
    if (index >= 0 && index < geoDataGlobal.features.length) {
        if (currentHoverIndex !== index) {
            currentHoverIndex = index;
            
            // شروع انیمیشن از صفر برای نرمی حرکت
            hoverState.offset = 0;
            animateHover(HOVER_OFFSET);
            
            // نمایش نام کشور
            countryLabel.innerText = geoDataGlobal.features[index].properties.name;
            countryLabel.style.opacity = '1';
            canvas.style.cursor = 'pointer';
        }
    } else {
        // اگر موس روی اقیانوس است
        if (currentHoverIndex !== -1) {
            currentHoverIndex = -1;
            hoverState.offset = 0; 
            draw();
            
            countryLabel.style.opacity = '0';
            canvas.style.cursor = 'default';
        }
    }
});