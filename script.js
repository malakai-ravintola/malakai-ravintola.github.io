const menuButton = document.getElementById("menu-button");
const menu = document.getElementById("menu");
const closeMenu = document.getElementById("close-menu");
const href = document.querySelectorAll("a");

menuButton.addEventListener("click", function () {
    menu.classList.remove("hidden");
    menuButton.classList.add("hidden");
});

closeMenu.addEventListener("click", function () {
    menu.classList.add("hidden");
    menuButton.classList.remove("hidden");
});
href.forEach(function (a) {
    a.addEventListener("click", function () {
        menu.classList.add("hidden");
        menuButton.classList.remove("hidden");
    });
});

let slideIndex = 1;
showSlides(slideIndex);

function plusSlides(n) {
  showSlides(slideIndex += n);
}

function currentSlide(n) {
  showSlides(slideIndex = n);
}

function showSlides(n) {
  let i;
  let slides = document.getElementsByClassName("mySlides");
  let dots = document.getElementsByClassName("demo");
  let captionText = document.getElementById("caption");
  if (n > slides.length) {slideIndex = 1}
  if (n < 1) {slideIndex = slides.length}
  for (i = 0; i < slides.length; i++) {
    slides[i].style.display = "none";
  }
  for (i = 0; i < dots.length; i++) {
    dots[i].className = dots[i].className.replace(" active", "");
  }
  slides[slideIndex-1].style.display = "block";
}

document.getElementById('openWidget').addEventListener('click', function() {
  window.open(
    'https://order.site/malakai-ravintola/en/fin/lempaala/restaurant/malakai-ravintola-sf/Tilaa-widget/',
    'Tilaa',
    'width=300,height=500'
  );
});

document.getElementById('openWidgetHeader').addEventListener('click', function() {
  window.open(
    'https://order.site/malakai-ravintola/en/fin/lempaala/restaurant/malakai-ravintola-sf/Tilaa-widget/',
    'Tilaa',
    'width=300,height=500'
  );
});


