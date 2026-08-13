const menuButton = document.getElementById("menu-button");
const menu = document.getElementById("menu");
const closeMenu = document.getElementById("close-menu");

if (menuButton && menu) {
    menuButton.addEventListener("click", function () {
        menu.classList.remove("hidden");
        menuButton.classList.add("hidden");
    });
}

if (closeMenu && menu && menuButton) {
    closeMenu.addEventListener("click", function () {
        menu.classList.add("hidden");
        menuButton.classList.remove("hidden");
    });
}

// Sulje mobiilivalikko linkkiä painettaessa
document.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () {
        if (menu && menuButton) {
            menu.classList.add("hidden");
            menuButton.classList.remove("hidden");
        }
    });
});


// RUOKALISTAN KUVAKARUSELLI

let slideIndex = 1;

function showSlides(n) {
    const slides = document.getElementsByClassName("mySlides");
    const dots = document.getElementsByClassName("demo");

    if (!slides.length) return;

    if (n > slides.length) {
        slideIndex = 1;
    }

    if (n < 1) {
        slideIndex = slides.length;
    }

    for (let i = 0; i < slides.length; i++) {
        slides[i].style.display = "none";
    }

    for (let i = 0; i < dots.length; i++) {
        dots[i].className = dots[i].className.replace(" active", "");
    }

    slides[slideIndex - 1].style.display = "block";
}

function plusSlides(n) {
    showSlides(slideIndex += n);
}

function currentSlide(n) {
    showSlides(slideIndex = n);
}

showSlides(slideIndex);


// TILAUSPAINIKE

const orderUrl =
    "https://order.site/malakai-ravintola/en/fin/lempaala/restaurant/malakai-ravintola-sf/Tilaa-widget/";

const openWidget = document.getElementById("openWidget");
const openWidgetHeader = document.getElementById("openWidgetHeader");

if (openWidget) {
    openWidget.addEventListener("click", function () {
        window.open(orderUrl, "_blank");
    });
}

if (openWidgetHeader) {
    openWidgetHeader.addEventListener("click", function () {
        window.open(orderUrl, "_blank");
    });
}
