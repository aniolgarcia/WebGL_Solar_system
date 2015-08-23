// objloader.js
// Freely borrows from https://github.com/frenchtoast747/WebGL-Obj-Loader.git,
// but removes dependency on jQuery by using AJAX directly.  (a.v.)

//
// Definition of Mesh object:
// Must be called with url of model, leaving out the extension
//
function Mesh(url) { 
    this.loaded = false;
    if (UrlExists(url+'.mtl')) {
	// attempt to load materials for this model:
	getMeshFromServer(url+'.mtl', this,  function(txt, ob) { 
	    parseMTL(txt); 
	    // then, whatever the result, go for the geometry:
	    getMeshFromServer(url+'.obj', ob, function(txt, ob){
		parseOBJ(txt, ob);
		ob.loaded = true;
	    });
	}); 
    } else { // No materials
	getMeshFromServer(url+'.obj', this, function(txt, ob){
	    parseOBJ(txt, ob);
	    ob.loaded = true;
	});
    }
}

Mesh.prototype.draw = function(gl, shaderProgram) {
    // first call:
    if (!this.loaded) return;
    // set up buffers:
    this.normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertexNormals), gl.STATIC_DRAW);
    this.normalBuffer.itemSize = 3;
    this.normalBuffer.numItems = this.vertexNormals.length / 3;

    if (this.hasTextures) {
	this.textureBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, this.textureBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.textures), gl.STATIC_DRAW);
	this.textureBuffer.itemSize = 2;
	this.textureBuffer.numItems = this.textures.length / 2;
    }

    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertices), gl.STATIC_DRAW);
    this.vertexBuffer.itemSize = 3;
    this.vertexBuffer.numItems = this.vertices.length / 3;

    this.colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.colors), gl.STATIC_DRAW);
    this.colorBuffer.itemSize = 3;
    this.colorBuffer.numItems = this.colors.length / 3;

    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.indices), gl.STATIC_DRAW);
    this.indexBuffer.itemSize = 1;
    this.indexBuffer.numItems = this.indices.length;

	// redefine for future calls:
	this.draw = function(gl,shaderProgram) {
	    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
	    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, this.vertexBuffer.itemSize, gl.FLOAT, false, 0, 0);
	    
	    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
	    gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, this.normalBuffer.itemSize, gl.FLOAT, false, 0, 0);

	    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
	    gl.vertexAttribPointer(shaderProgram.vertexColorAttribute, this.colorBuffer.itemSize, gl.FLOAT, false, 0, 0);

	    if (this.hasTextures) {
		gl.bindBuffer(gl.ARRAY_BUFFER, this.textureBuffer);
		gl.vertexAttribPointer(shaderProgram.vertexTextureAttribute, this.colorBuffer.itemSize, gl.FLOAT, false, 0, 0);
	    }

	    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
	    gl.drawElements(gl.TRIANGLES, this.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
	}
	this.draw(gl, shaderProgram);
    }

//
// Utility functions and tools:

// Thanks to CMS for the startsWith function
// http://stackoverflow.com/questions/646628/javascript-startswith/646643#646643
if (typeof String.prototype.startsWith !== 'function') {
  String.prototype.startsWith = function (str){
    return this.slice(0, str.length) === str;
  };
}

// See https://developer.mozilla.org/en-US/docs/AJAX/Getting_Started
function getMeshFromServer(url, ob, doneCB) {
    var httpr;
    if (window.XMLHttpRequest) {
	httpr = new XMLHttpRequest();
	httpr.onreadystatechange = function() {
	    if (httpr.readyState===4) doneCB(httpr.responseText, ob);
	};
	httpr.open("GET", url, true);
	httpr.send();
    } else {
	alert("Cannot find XMLHttpRequest object for my AJAX!\nWill not load objs.");
    }
}

// See: http://stackoverflow.com/questions/3646914/how-do-i-check-if-file-exists-in-jquery-or-javascript
function UrlExists(url)
{
    var http = new XMLHttpRequest();
    http.open('HEAD', url, false);
    http.send();
    return http.status!=404;
}

var Materials = {};

function tblSize(ob) {
    var count = 0;
    for (var i in ob) ++count;
    return count;
}

function parseMTL(txt) {
    var lines = txt.split('\n');
    var i = 0;
    var nomMtl;
    while (i < lines.length) {
	 if(lines[i].startsWith("newmtl")) {
	     nomMtl = lines[i].split(/\s+/)[1]
	     while (i < lines.length &&  !lines[i].startsWith('Kd'))  ++i;
	     if (i < lines.length) {
		 var col = new Array();
		 var cntnts = lines[i].slice(3).split(/\s+/);
		 for (var j = 0; j < 3; ++j) col.push(parseFloat(cntnts[j]));
	 	 Materials[nomMtl] = col;
	     }
	 }
	++i;
    }
}

function parseOBJ(txt, msh) {
    var verts = [];
    var vertNormals = [];
    var textures = [];
    var currentMat = "";
    
    // unpacking stuff
    var packed = {};
    packed.verts = [];
    packed.norms = [];
    packed.textures = [];
    packed.colors = [];
    packed.hashindices = {};
    packed.indices = [];
    packed.index = 0;

    var hasColors = tblSize(Materials) != 0;
    var defltMat = [0.5, 0.0, 0.0];

    var hasNormals = false;
    var hasTextures = false;

    function addOnePt(txt) {
	if( txt in packed.hashindices ){
            packed.indices.push(packed.hashindices[txt]);
	}
	else{
            face = txt.replace(/\s+/, "").split('/')
            // vertex position
            packed.verts.push( parseFloat(verts[ (face[ 0 ] - 1) * 3 + 0 ] ));
            packed.verts.push( parseFloat(verts[ (face[ 0 ] - 1) * 3 + 1 ] ));
            packed.verts.push( parseFloat(verts[ (face[ 0 ] - 1) * 3 + 2 ] ));
            // vertex textures
	    if (hasTextures) {
		packed.textures.push( parseFloat(textures[ (face[ 1 ] - 1) * 2 + 0 ] ));
		packed.textures.push( parseFloat(textures[ (face[ 1 ] - 1) * 2 + 1 ] ));
	    }
            // vertex normals
	    if (hasNormals) {
		packed.norms.push( parseFloat(vertNormals[(face[2] - 1)*3 + 0]));
		packed.norms.push( parseFloat(vertNormals[(face[2] - 1)*3 + 1]));
		packed.norms.push( parseFloat(vertNormals[(face[2] - 1)*3 + 2]));
	    } else {
		packed.norms.push(faceNormal[0]);
		packed.norms.push(faceNormal[1]);
		packed.norms.push(faceNormal[2]);
	    }
	    // colors
	    var matrl = defltMat;
	    if (currentMat != "" ) matrl = currentMat;
	    packed.colors.push(matrl[0]);
	    packed.colors.push(matrl[1]);
	    packed.colors.push(matrl[2]);

            // add the newly created vertex to the list of indices
            packed.hashindices[txt] = packed.index;
            packed.indices.push(packed.index);
            // increment the counter
            packed.index += 1;
	}	
    }

    function compNormal(a, b, c) {
	var ia = parseInt(a.replace(/\s+/, "").split('/')[0]);
	var ib = parseInt(b.replace(/\s+/, "").split('/')[0]);
	var ic = parseInt(c.replace(/\s+/, "").split('/')[0]);

	var v1 = {}, v2 = {}, n = {};
	v1.x = parseFloat(verts[(ib - 1)*3 + 0]) - parseFloat(verts[(ia - 1)*3 + 0]);
	v1.y = parseFloat(verts[(ib - 1)*3 + 1]) - parseFloat(verts[(ia - 1)*3 + 1]);
	v1.z = parseFloat(verts[(ib - 1)*3 + 2]) - parseFloat(verts[(ia - 1)*3 + 2]);
	v2.x = parseFloat(verts[(ic - 1)*3 + 0]) - parseFloat(verts[(ia - 1)*3 + 0]);
	v2.y = parseFloat(verts[(ic - 1)*3 + 1]) - parseFloat(verts[(ia - 1)*3 + 1]);
	v2.z = parseFloat(verts[(ic - 1)*3 + 2]) - parseFloat(verts[(ia - 1)*3 + 2]);

	n.x = v1.y*v2.z - v1.z*v2.y;
	n.y = v1.z*v2.x - v1.x*v2.z;
	n.z = v1.x*v2.y - v1.y*v2.x;
	var norm = Math.sqrt(n.x*n.x + n.y*n.y + n.z*n.z);
	return [n.x/norm, n.y/norm, n.z/norm];
    }
    
    var line;
    // array of lines separated by the newline
    var lines = txt.split( '\n' )
    for( var i=0; i<lines.length; ++i ){
	if (lines[i][0] == '#') continue;
	// if this is a vertex
	if (lines[i].startsWith('v ')){
            line = lines[i].slice(2).split(/\s+/)
            verts.push(line[0]);
            verts.push(line[1]);
            verts.push(line[2]);
	}
	// if this is a vertex normal
	else if (lines[i].startsWith('vn')){
	    hasNormals = true;
            line = lines[i].slice(3).split(/\s+/)
            vertNormals.push(line[0]);
            vertNormals.push(line[1]);
            vertNormals.push(line[2]);
	}
	// if this is a texture
	else if (lines[i].startsWith('vt')){
	    hasTextures = true;
            line = lines[i].slice(3).split(" ")
            textures.push(line[0]);
            textures.push(line[1]);
	}
	// if this is a material declr:
	else if (lines[i].startsWith('usemtl ') || lines[i].startsWith('g ')) { // assumim material d'igual nom. si n'hi ha
	    if (Materials[lines[i].split(/\s+/)[1]]) currentMat = Materials[lines[i].split(/\s+/)[1]];
	    else currentMat = defltMat;
	}
	// if this is a face (we assume it is convex, at the least):
	else if( lines[i].startsWith('f ')){
	    if (!hasNormals && vertNormals.length == 0) {
		// Need to provide something!
		for (var k = 0; k < verts.length; ++k) vertNormals.push(0.0);
	    }
            line = lines[i].slice(2).split(/\s+/);
	    if (hasNormals) 
		for(var j=1; j<line.length-1; j++){
		    addOnePt(line[0]);
		    addOnePt(line[j]);
		    addOnePt(line[j+1]);
		}
	    else {
		var faceNormal = compNormal(line[0], line[1], line[2]);
		for(var j=1; j<line.length-1; j++){
		    addOnePt(line[0]+'///'+faceNormal);
		    addOnePt(line[j]+'///'+faceNormal);
		    addOnePt(line[j+1]+'///'+faceNormal);
		}
	    }
	}
    }
    msh.vertices = packed.verts;
    msh.vertexNormals = packed.norms;
    msh.textures = packed.textures;
    msh.colors = packed.colors;
    msh.indices = packed.indices;
    msh.hasColors = hasColors;
    msh.hasNormals = hasNormals;
    msh.hasTextures = hasTextures;
}

