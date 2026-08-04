const backToTop = document.createElement("button");

backToTop.innerHTML = "↑";

backToTop.className = "back-to-top";

document.body.appendChild(backToTop);


window.addEventListener("scroll", function(){

    if(window.scrollY > 400){

        backToTop.style.display="flex";

    }else{

        backToTop.style.display="none";

    }

});


backToTop.onclick=function(){

    window.scrollTo({

        top:0,

        behavior:"smooth"

    });

};