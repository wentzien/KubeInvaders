var canvas = document.getElementById("myCanvas");
var ctx = canvas.getContext("2d");
var ballRadius = 7;
var x = canvas.width/2;
var y = canvas.height-30;
var dx = 2;
var dy = -2;
var spaceshipHeight = 60;
var spaceshipWidth = 60;
var spaceshipX = (canvas.width-spaceshipWidth)/2;
var spaceshipY = (canvas.height-spaceshipHeight)/2;
var cluster = "CLUSTER_PLACEOLDER";
var namespaces = [];
var namespaces_index = 0;
var namespace = namespaces[namespaces_index];
var endpoint = "";
var modal_opened = false;
var autoPilot = false;
var autoPilotDirection = 0;
var spaceshipxOld = 0;
var randomFactor = 10;
// pods list from kubernetes
var pods = [];

// nodes list from kubernetes
var nodes = [];

var mergeNodesAndPods = [];

// Hash of aliens related to pods or nodes
var aliens = [];
/*
Alien item active
aliens = [{
    "x": 0,
    "y": 0,
    "active": true,
    "name": "name of the pods or node"
}]
Alien item of a dead pod
aliens = [{
    "x": 0,
    "y": 0,
    "active": true,
    "name": "killed_pod"
}]
*/

var aliensWidth = 40;
var aliensHeight = 40;

// Button vars
var rightPressed = false;
var leftPressed = false;
var upPressed = false;
var downPressed = false;

// The is true the rocket can move
var shot = false;

// Keep track of rocket launch
var rocketLaunched = false;

// Rocket position
var rocketX = -400;
var rocketY = -400;
var rocketSpeed = 7;

var collisionDetected = false;

// Aliens Vars. Keep track of Y positions where there is an alien.
var aliensY = [];
var aliensIncrementY = 50;

var shuffle = true;
var help = false;
var chaos_nodes = true;
var chaos_pods = true;

function IsJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

function contains(a, obj) {
    for (var i = 0; i < a.length; i++) {
        if (a[i] === obj) {
            return true;
        }
    }
    return false;
}

function getMetrics() {
    var oReq = new XMLHttpRequest();
    oReq.onload = function () {
    	console.log(this.responseText);
        var lines = this.responseText.split('\n');
        for (var i = 0;i < lines.length;i++){
            metric = lines[i].split(' ');
            if (metric[0] == "chaos_node_jobs_total") {
                chaos_jobs_total
                $('#chaos_jobs_total').text(metric[1]);
            }
            else if (metric[0] == "deleted_pods_total") {
                $('#deleted_pods_total').text(metric[1]);            
            }
            else if (metric[0] == "fewer_replicas_seconds") {
                $('#fewer_replicas_seconds').text(metric[1]);            
            }
            else if (metric[0] == "latest_fewer_replicas_seconds") {
                $('#latest_fewer_replicas_seconds').text(metric[1]);            
            }
            else if (metric[0] == "pods_not_running_on_selected_ns") {
                $('#pods_not_running_on').text(metric[1]);            
            }
        }
    };;
    oReq.open("GET", "http://ENDPOINT_PLACEHOLDER/metrics");
    oReq.send();
}

function getNamespaces() {
    var oReq = new XMLHttpRequest();
    oReq.onload = function () {
    	namespaces = this.responseText;
	    namespaces = namespaces.split(",");
	    namespace = namespaces[namespaces_index];
    };;
    oReq.open("GET", "http://ENDPOINT_PLACEHOLDER/kube/namespaces");
    oReq.send();
}

function getEndpoint() {
    var oReq = new XMLHttpRequest();
    oReq.onload = function () {
        endpoint = this.responseText;
    };;
    oReq.open("GET", "http://ENDPOINT_PLACEHOLDER/kube/endpoint");
    oReq.send();
}

function getCurrentChaosContainer() {
    var oReq = new XMLHttpRequest();
    oReq.onload = function () {
        console.log(this.responseText);
        job_parsed = JSON.stringify(JSON.parse(this.responseText), null, 4);
        console.log(job_parsed);
        $('#currentChaosContainrYaml').text(job_parsed);
        $('#currentChaosContainerJsonTextArea').val(job_parsed);
    };;
    oReq.open("GET", "http://ENDPOINT_PLACEHOLDER/kube/chaos/containers?action=container_definition");
    oReq.send();
}

function setChaosContainer() {
    if (!IsJsonString($('#currentChaosContainerJsonTextArea').val())) {
        $('#alert_placeholder2').text('JSON syntax not valid.');
    }
    else {
        var oReq = new XMLHttpRequest();
        oReq.open("POST", "http://ENDPOINT_PLACEHOLDER/kube/chaos/containers?action=set", true);

        oReq.onreadystatechange = function () {
            if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
                console.log(this.responseText);
                $('#alert_placeholder2').text('New container definition has been saved.');
            }
        };;
        oReq.setRequestHeader("Content-Type", "application/json");
        oReq.send($('#currentChaosContainerJsonTextArea').val());
    }
}

function startChaosNode(node_name) {
    var oReq = new XMLHttpRequest();
    oReq.onload = function () {
        //console.log(JSON.parse(this.responseText))
    };;
    $('#alert_placeholder').replaceWith('<div id="alert_placeholder" style="margin-top: 3%;" class="alert alert-info" role="alert">Latest action: Start Chaos Job on ' + node_name + '</div>');
    oReq.open("GET", "http://ENDPOINT_PLACEHOLDER/kube/chaos/nodes?nodename=" + node_name + "&namespace=" + namespace);
    oReq.send();
}

function deletePods(pod_name) {
    var oReq = new XMLHttpRequest();
    oReq.onload = function () {
        //console.log(JSON.parse(this.responseText))
    };;
    $('#alert_placeholder').replaceWith('<div id="alert_placeholder" style="margin-top: 3%;" class="alert alert-info" role="alert">Latest action: Kill ' + pod_name + '</div>');
    oReq.open("GET", "http://ENDPOINT_PLACEHOLDER/kube/pods?action=delete&pod_name=" + pod_name + "&namespace=" + namespace);
    oReq.send();
}

function getPods() {
    if (chaos_pods) {
        var oReq = new XMLHttpRequest();
        oReq.onload = function () {
            json_parsed = JSON.parse(this.responseText);
            if (nodes && nodes.length > 0) {
                pods = json_parsed["items"].concat(nodes);
            } else {
                pods = json_parsed["items"];
            }
        };;
        oReq.open("GET", "http://ENDPOINT_PLACEHOLDER/kube/pods?action=list&namespace=" + namespace);
        oReq.send();
    }
    else {
        if (nodes && nodes.length > 0) {
            pods = nodes;
        } else {
            pods = [];
        }    
    }
}

function getNodes() {
    if (chaos_nodes) {
        var oReq = new XMLHttpRequest();
        oReq.onload = function () {
            json_parsed = JSON.parse(this.responseText);
            nodes = json_parsed["items"];
        };;
        oReq.open("GET", "http://ENDPOINT_PLACEHOLDER/kube/nodes");
        oReq.send();
    }
    else {
        nodes = []
    }
}

window.setInterval(function getKubeItems() { 
    getNodes();
    getPods();
}, 1000)

function keyDownHandler(e) {
    if (!modal_opened) {
        e.preventDefault();
        if(e.key == "Right" || e.key == "ArrowRight") {
            rightPressed = true;
            //console.log("Go right");
            //console.log("Spaceship Y:" + spaceshipY);
            //console.log("Spaceship X: " + spaceshipX);
        }
        else if(e.key == "Left" || e.key == "ArrowLeft") {
            leftPressed = true;
            //console.log("Go left");
            //console.log("Spaceship Y:" + spaceshipY);
            //console.log("Spaceship X: " + spaceshipX);
        }
        if(e.key == "Up" || e.key == "ArrowUp") {
            upPressed = true;
            //console.log("Go up");
            //console.log("Spaceship Y:" + spaceshipY);
            //console.log("Spaceship X: " + spaceshipX);
        }
        else if(e.key == "Down" || e.key == "ArrowDown") {
            downPressed = true;
            //console.log("Go down");
            //console.log("Spaceship Y: " + spaceshipY);
            //console.log("Spaceship X: " + spaceshipX);
        }
        else if(e.keyCode == 83) {
            if (shuffle) {
                shuffle = false;
                $('#alert_placeholder').replaceWith('<div id="alert_placeholder" style="margin-top: 3%;" class="alert alert-info" role="alert">Latest action: Disable shuffle</div>');
                //console.log("Deactivate shuffle");
            }
            else {
                shuffle = true
                //console.log("Activate shuffle");
                $('#alert_placeholder').replaceWith('<div id="alert_placeholder" style="margin-top: 3%;" class="alert alert-info" role="alert">Latest action: Enable shuffle</div>');
            }
        }
        else if(e.keyCode == 32) {
            //console.log("Shot");
            shot = true
        }
        else if(e.keyCode == 78) {
            //console.log("Change Namespace");
            if (namespaces_index < namespaces.length-1) {
                namespaces_index +=1 ;
            }
            else {
                namespaces_index = 0;
            }
            namespace = namespaces[namespaces_index];
            $('#alert_placeholder').replaceWith('<div id="alert_placeholder" class="alert alert-info" style="margin-top: 3%;" role="alert">Latest action: Change target namespace to ' + namespace + '</div>');
            aliens = [];
            pods = [];
        }
        else if(e.keyCode == 72) {
            if (help) {
                help = false;
            }
            else {
                help = true
            }
        }
        else if(e.keyCode == 67) {
            if (chaos_nodes) {
                chaos_nodes = false;
                $('#alert_placeholder').replaceWith('<div id="alert_placeholder" style="margin-top: 3%;" class="alert alert-info" role="alert">Latest action: Hide nodes</div>');

            }
            else {
                chaos_nodes = true
                $('#alert_placeholder').replaceWith('<div id="alert_placeholder" style="margin-top: 3%;" class="alert alert-info" role="alert">Latest action: Show nodes</div>');
            }
        }
        else if(e.keyCode == 80) {
            if (chaos_pods) {
                chaos_pods = false;
                $('#alert_placeholder').replaceWith('<div id="alert_placeholder" style="margin-top: 3%;" class="alert alert-info" role="alert">Latest action: Hide pods</div>');
            }
            else {
                chaos_pods = true
                $('#alert_placeholder').replaceWith('<div id="alert_placeholder" style="margin-top: 3%;" class="alert alert-info" role="alert">Latest action: Show pods</div>');
            }
        }
    }
}

function keyUpHandler(e) {
    if(e.key == "Right" || e.key == "ArrowRight") {
        rightPressed = false;
    }
    else if(e.key == "Left" || e.key == "ArrowLeft") {
        leftPressed = false;
    }
    else if(e.key == "Up" || e.key == "ArrowUp") {
        upPressed = false;
    }
    else if(e.key == "Down" || e.key == "ArrowDown") {
        downPressed = false;
    }
}

document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);

function drawAlien(alienX, alienY, name) {
    var image = new Image(); // Image constructor
    if (contains(nodes, name)) {
        image.src = './k8s_node.png';
        ctx.drawImage(image, alienX, alienY, 30, 40);
    }
    else {
        image.src = './sprite_invader.png';
        ctx.drawImage(image, alienX, alienY, 40, 40);
    }
    
    ctx.closePath();
}

function checkRocketAlienCollision() {
    if (contains(aliensY, rocketY)) {
        //console.log("The y of rocket is the same of an alien. rocketY=" + rocketY + " List of aliensY:" + aliensY);
        var i;
        for (i=aliens.length - 1; i >= 0; i--) {
            if (aliens[i]["active"] && (rocketY - aliens[i]["y"] < 5)) {
                var rangeX = []
                rangeX.push(aliens[i]["x"]);

                for (k=aliens[i]["x"]; k<aliens[i]["x"]+aliensWidth; k++) {
                    rangeX.push(k);
                }

                //console.log("rangeX is:" + rangeX);
                
                if(contains(rangeX, rocketX)) {
                    //console.log("collision detected");
                    collisionDetected = true;
                    aliens[i]["active"] = false;
                    if (contains(nodes, aliens[i]["name"])) {
                        startChaosNode(aliens[i]["name"]);
                        aliens[i]["name"] = "killed_pod";
                    }
                    else {
                        deletePods(aliens[i]["name"]);
                        aliens[i]["name"] = "killed_pod";
                    }
                    return true;
                }
            }
        } 
    }
    return false;
}

function shuffleAliens() {
    pods = pods.sort(() => Math.random() - 0.5)
}
function drawRocket() {
    var image = new Image(); // Image constructor
    image.src = './kuberocket.png';
    ctx.drawImage(image, rocketX, rocketY, 20, 20);

    ctx.closePath();

    if (checkRocketAlienCollision()) {
        rocketY = -100;
        rocketX = -100;
        collisionDetected = false;
        return
    }

    if(shot && rocketLaunched) {
        if (rocketY < 0) {
            //console.log("Rocket arrived to the end of canvas");
            shot = false;
            rocketLaunched = false;
        }
        else {
            rocketY = rocketY -= rocketSpeed;
        }
    }
    else {
        rocketX = spaceshipX + (spaceshipWidth / 2);
        rocketY = spaceshipY;
        rocketLaunched = true
    }
}

function drawSpaceship() {
    var image = new Image(); // Image constructor
    image.src = './spaceship.png';
    ctx.drawImage(image, spaceshipX, spaceshipY, 60, 60);
    ctx.closePath();
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

window.setInterval(function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawSpaceship();
    
    if (shot && !collisionDetected) {
        drawRocket();
    }

    if(x + dx > canvas.width-ballRadius || x + dx < ballRadius) {
        dx = -dx;
    }
    if(y + dy > canvas.height-ballRadius || y + dy < ballRadius) {
        dy = -dy;
    }
    
    if (autoPilot){
        spaceshipY = 340;
        
        if (getRandomInt(100) < randomFactor) {
            shot = true;
        }
        
        if (autoPilotDirection == 0) {
            autoPilotDirection = getRandomInt(canvas.width-spaceshipWidth);
            spaceshipxOld = spaceshipX;
        } 
        else if ((spaceshipX == autoPilotDirection)) {
            autoPilotDirection = getRandomInt(canvas.width-spaceshipWidth);
            spaceshipxOld = spaceshipX;
        }
        else if ((autoPilotDirection < spaceshipxOld) && (spaceshipX < autoPilotDirection)) {
            autoPilotDirection = getRandomInt(canvas.width-spaceshipWidth);
            spaceshipxOld = spaceshipX;
        }
        else if ((autoPilotDirection > spaceshipxOld) && (spaceshipX > autoPilotDirection)) {
            autoPilotDirection = getRandomInt(canvas.width-spaceshipWidth);
            spaceshipxOld = spaceshipX;
        }
        else {
            if (autoPilotDirection > spaceshipX) {
                spaceshipX += 5;
            }
            else {
                spaceshipX -= 5;
            }
        }
        
    }

    if(rightPressed) {
        spaceshipX += 3;
        if (spaceshipX + spaceshipWidth > canvas.width) {
            spaceshipX = canvas.width - spaceshipWidth;
        }
    }
    else if(leftPressed) {
        spaceshipX -= 3;
        if (spaceshipX < 0) {
            spaceshipX = 0;
        }
    }

    if(upPressed) {
        spaceshipY -= 3;
        if (spaceshipY < 0) {
            spaceshipY = 0;
        }
    }

    else if (downPressed) {
        spaceshipY += 3;
        if (spaceshipY + spaceshipHeight > canvas.height) {
            spaceshipY = canvas.height - spaceshipHeight;
        }
    }
    
    for (i=0; i<aliens.length; i++) {
        if (aliens[i]["active"]) {
            drawAlien(aliens[i]["x"], aliens[i]["y"], aliens[i]["name"]);
        }
    }
    ctx.fillStyle = 'white';
    ctx.font = '15px Verdana';
    ctx.fillText('Cluster: ' + endpoint, 10, 400);
    ctx.fillText('Current Namespace: ' + namespace, 10, 420);
    ctx.fillText('Alien Shuffle: ' + shuffle, 10, 440);
    ctx.fillText('press \'h\' for help!', 10, 470);

    if (help) {
        ctx.fillText('h => Activate or deactivate help', 10, 280);
        ctx.fillText('s => Activate or deactivate shuffle for aliens', 10, 300);
        ctx.fillText('n => Change namespace', 10, 320);
        ctx.fillText('p => Activate or deactivate chaos engineering against pods', 10, 340);
        ctx.fillText('c => Activate or deactivate chaos engineering against nodes', 10, 360);
    }
}, 10)

function podExists(podName) {
    for (i=0; i<aliens.length; i++) {
        if (aliens[i]["name"] == podName) {
            return true;
        }
    }
    return false;
}

function findReplace() {
    for (i=0; i<aliens.length; i++) {
        if (!aliens[i]["active"]) {
            return i;
        }
    }
    return -1;
}
    
window.setInterval(function setAliens() {
    if (shuffle) {
        pods = pods.sort(() => Math.random() - 0.5)
    }
    aliens = [];
    //console.log("Length of aliensY array: " + aliensY.length);
    if (pods.length > 0) {
        for (k=10; k>0; k--) {
            if (!contains(aliensY, k)) {
                aliensY.push(k);
            }
        }
        var x = 10;
        var y = 10;
        for (i=0; i<pods.length; i++) {
            if(!podExists(pods[i])) {
                var replaceWith = findReplace();
                if (replaceWith != -1) {
                    aliens[replaceWith] = {"name": pods[i], "x": aliens[replaceWith]["x"], "y": aliens[replaceWith]["y"], "active": true}
                    cnt =+ 1;
                }
                else {
                    aliens.push({"name": pods[i], "x": x, "y": y, "active": true});
                    cnt =+ 1;
                }
                if (aliens.length % 12 == 0) {
                    //console.log("we need another line of aliens for Y="+aliensIncrementY);
                    x = 10;
                    y += aliensIncrementY;
                    for (k=y+10; k>=y; k--) {
                        if (!contains(aliensY, k)) {
                            aliensY.push(k);
                        }
                    }
                    //console.log("aliensY contains new Y for detecting eventual collisions. aliensY="+aliensY);
                }
                else {
                    x += 60;
                }
            }
        }
    }
}, 1000)

window.setInterval(function metrics() {
    getMetrics()
}, 2000)

getEndpoint();
getNamespaces();
