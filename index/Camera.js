    function Camera() {
	this.rot = vec2.fromValues(0.0, 0.0);
	this.pos = vec3.fromValues(0.0, 0.0, 0.0);
    }	

    Camera.prototype.rotateY = function(deg){
	this.rot[1] += deg;
	if(this.rot[1] > 360) {
		this.rot[1] -= 360;
	}
	else if(this.rot[1] < 360) {
		this.rot[1] += 360;
	}
    }

    Camera.prototype.rotateX = function(deg){
	this.rot[0] += deg;
	if(this.rot[0] > 89.9) {
		this.rot[0] = 89.9;
	}
	else if(this.rot[0] < -89.9) {
		this.rot[0] = -89.9;
	}
    }
