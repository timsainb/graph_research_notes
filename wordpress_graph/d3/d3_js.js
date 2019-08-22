var width = 960,
    height = 800;

//Set up the colour scale
var color = d3.scale.category20();

//Set up the force layout
var force = d3.layout.force()
    .charge(-200)
    .linkDistance(80)
    .size([width, height]);

//Append a SVG to the body of the html page. Assign this SVG as an object to svg
var svg = d3.select("#$graph-div").append("svg")
    .attr("width", width)
    .attr("height", height);

//---Insert------
//Set up tooltip
var tip = d3.tip()
    .attr('class', 'd3-tip')
    .offset([-10, 0])
    .html(function (d) {
        return d.name + "</span>";
    })
svg.call(tip);
//---End Insert---

// Reads json file 
function readTextFile(file, callback) {
    var rawFile = new XMLHttpRequest();
    rawFile.overrideMimeType("application/json");
    rawFile.open("GET", file, true);
    rawFile.onreadystatechange = function () {
        if (rawFile.readyState === 4 && rawFile.status == "200") {
            callback(rawFile.responseText);
        }
    }
    rawFile.send(null);
};
var mis = document.getElementById('mis').innerHTML;
graph = JSON.parse(mis);
graphRec = JSON.parse(JSON.stringify(graph)); //Add this line


//Creates the graph data structure out of the json data
force.nodes(graph.nodes)
    .links(graph.links)
    .start();

//Create all the line svgs but without locations yet
var link = svg.selectAll(".link")
    .data(graph.links)
    .enter().append("line")
    .attr("class", "link")
    .style("stroke-width", function (d) {
        return Math.sqrt(d.value);
    });

//Do the same with the circles for the nodes - no 
var node = svg.selectAll(".node")
    .data(graph.nodes)
    .enter().append("circle")
    .attr("class", "node")
    .attr("r", 8)
    .style("fill", function (d) {
        return color(d.group);
    })
    .call(force.drag) // 
    .on('click', connectedNodes) //Added code 
    .on('mouseover', tip.show) //Added
    .on('mouseout', tip.hide); //Added


//Now we are giving the SVGs co-ordinates - the force layout is generating the co-ordinates which this code is using to update the attributes of the SVG elements
force.on("tick", function () {
    link.attr("x1", function (d) {
        return d.source.x;
    })
        .attr("y1", function (d) {
            return d.source.y;
        })
        .attr("x2", function (d) {
            return d.target.x;
        })
        .attr("y2", function (d) {
            return d.target.y;
        });

    node.attr("cx", function (d) {
        return d.x;
    })
        .attr("cy", function (d) {
            return d.y;
        });
    node.each(collide(0.5)); //Added 
});


var optArray = [];
for (var i = 0; i < graph.nodes.length - 1; i++) {
    optArray.push(graph.nodes[i].name);
}

optArray = optArray.sort();
$$(function () {
    $$("#search").autocomplete({
        source: optArray
    });
});

function searchNode() {
    //find the node
    var selectedVal = document.getElementById('search').value;
    var node = svg.selectAll(".node");
    if (selectedVal == "none") {
        node.style("stroke", "white").style("stroke-width", "5");
    } else {
        var selected = node.filter(function (d, i) {
            return d.name != selectedVal;
        });
        var not_selected = node.filter(function (d, i) {
            return d.name == selectedVal;
        });
        not_selected.attr("r", 15)
        selected.style("opacity", "0");

        var link = svg.selectAll(".link")
        link.style("opacity", "0");
        d3.selectAll(".node, .link").transition()
            .duration(1000)
            .attr("r", 8)
            .style("opacity", 1);
        //not_selected.connectedNodes()
    }
}

//---Insert-------

//adjust threshold

function threshold(thresh) {
    graph.links.splice(0, graph.links.length);

    for (var i = 0; i < graphRec.links.length; i++) {
        if (graphRec.links[i].value > thresh) { graph.links.push(graphRec.links[i]); }
    }

    linkedByIndex = {};
    for (i = 0; i < graph.nodes.length; i++) {
        linkedByIndex[i + "," + i] = 1;
    };
    // for each link
    for (var i = 0; i < graphRec.links.length; i++) {
        if (graphRec.links[i].value > thresh) {
            //  add this link
            linkedByIndex[graphRec.links[i].source.index + "," + graphRec.links[i].target.index] = 1;

        }
    }

    restart();

}


//Restart the visualisation after any node and link changes

function restart() {

    link = link.data(graph.links);
    link.exit().remove();
    link.enter().insert("line", ".node").attr("class", "link");
    node = node.data(graph.nodes);
    node.enter().insert("circle", ".cursor").attr("class", "node").attr("r", 5).call(force.drag);
    force.start();



}
//---End Insert---
var padding = 1, // separation between circles
    radius = 8;
function collide(alpha) {
    var quadtree = d3.geom.quadtree(graph.nodes);
    return function (d) {
        var rb = 2 * radius + padding,
            nx1 = d.x - rb,
            nx2 = d.x + rb,
            ny1 = d.y - rb,
            ny2 = d.y + rb;
        quadtree.visit(function (quad, x1, y1, x2, y2) {
            if (quad.point && (quad.point !== d)) {
                var x = d.x - quad.point.x,
                    y = d.y - quad.point.y,
                    l = Math.sqrt(x * x + y * y);
                if (l < rb) {
                    l = (l - rb) / l * alpha;
                    d.x -= x *= l;
                    d.y -= y *= l;
                    quad.point.x += x;
                    quad.point.y += y;
                }
            }
            return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
        });
    };
}

function addp(str) {
    var par = document.createElement('p');
    par.appendChild(document.createTextNode(str));

    document.getElementById('inner_neighbors').appendChild(par);
}


var neighbors_list = []
//Toggle stores whether the highlighting is on
var toggle = 0;
//Create an array logging what is connected to what
var linkedByIndex = {};
for (i = 0; i < graph.nodes.length; i++) {
    linkedByIndex[i + "," + i] = 1;
};
graph.links.forEach(function (d) {
    linkedByIndex[d.source.index + "," + d.target.index] = 1;
});
//This function looks up whether a pair are neighbours
function neighboring(a, b) {
    if (a.name != b.name) {
        if (linkedByIndex[a.index + "," + b.index]) {
            //document.getElementById("neighbors").innerHTML += a.name
            if (a.index != b.index) {
                if ($$.inArray(a.name, neighbors_list) == -1) {
                    neighbors_list.push(a.name)
                }
                if ($$.inArray(b.name, neighbors_list) == -1) {
                    neighbors_list.push(b.name)
                }
            }
        }
    }
    return linkedByIndex[a.index + "," + b.index];
}


function connectedNodes() {
    if (toggle == 0) {
        //Reduce the opacity of all but the neighbouring nodes
        d = d3.select(this).node().__data__;
        neighbors_list = []
        node.style("opacity", function (o) {
            return neighboring(d, o) | neighboring(o, d) ? 1 : 0.2;
        });
        link.style("opacity", function (o) {
            return d.index == o.source.index | d.index == o.target.index ? 1 : 0.2;
        });
        //Reduce the op

        if (neighbors_list.length > 5) {
            var short_list = neighbors_list.slice(0, 4);
        } else {
            var short_list = neighbors_list
        }

        short_list.forEach(addp);
        this.setAttribute("r", 12)
        document.getElementById("select_title_p").innerHTML = d.name
        toggle = 1;
    } else {
        //Put them back to opacity=1
        node.style("opacity", 1);
        link.style("opacity", 1);
        d3.selectAll(".node").transition()
            .duration(200)
            .attr("r", 8)
        document.getElementById("select_title_p").innerHTML = 'Select a node'
        document.getElementById("inner_neighbors").innerHTML = ''
        toggle = 0;
    }
}

$$(function () {
    $$("#neighbors").draggable();
});


var theScript = document.createElement("script");
theScript.setAttribute("type", "text/javascript");
theScript.setAttribute("src", "https://code.jquery.com/ui/1.12.0/jquery-ui.js");
document.getElementsByTagName("head")[0].appendChild(theScript);