console.log("Back to top loaded");


const backToTop = document.createElement("button");
backToTop.innerHTML = "⬆";
backToTop.className = "back-to-top";

document.body.appendChild(backToTop);


window.addEventListener("scroll", () => {

    if(window.scrollY > 300){
        backToTop.classList.add("show");
    } else {
        backToTop.classList.remove("show");
    }

});


backToTop.addEventListener("click",()=>{

    window.scrollTo({
        top:0,
        behavior:"smooth"
    });

});