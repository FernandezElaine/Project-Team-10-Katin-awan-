fetch("http://localhost:3000/chat", {
    method:"POST",
    headers:{
        "Content-Type":"application/json"
    },
    body:JSON.stringify({
        message:"Explain barangay projects"
    })
})
.then(res=>res.json())
.then(data=>{
    console.log(data);
});