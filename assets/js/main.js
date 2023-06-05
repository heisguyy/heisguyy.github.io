const hamburgerBtn = document.getElementById("nav-content-hamburger-btn")
const navContent = document.getElementById("nav-content")

hamburgerBtn.addEventListener("click", () => {
    if (navContent.style.display === "none") {
        navContent.style.display = "block";
    } else {
        navContent.style.display = "none";
    }
})