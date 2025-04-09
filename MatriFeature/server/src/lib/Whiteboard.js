class Whiteboard {
    constructor(room) {
      this.room = room;
      this.strokes = [];
      this.currentStroke = new Map(); // Map of peer ID to current stroke
      this.maxStrokes = 1000;
      this.backgroundColor = '#ffffff';
      this.canvasWidth = 1920;
      this.canvasHeight = 1080;
    }
  
    startStroke(peerId, startPoint, style) {
      const stroke = {
        id: `${peerId}-${Date.now()}`,
        peerId,
        points: [startPoint],
        style: {
          color: style.color || '#000000',
          width: style.width || 2,
          tool: style.tool || 'pen'
        },
        timestamp: new Date().toISOString()
      };
  
      this.currentStroke.set(peerId, stroke);
      return stroke;
    }
  
    addPoint(peerId, point) {
      const stroke = this.currentStroke.get(peerId);
      if (!stroke) {
        throw new Error('No active stroke found');
      }
  
      stroke.points.push(point);
      return stroke;
    }
  
    endStroke(peerId) {
      const stroke = this.currentStroke.get(peerId);
      if (!stroke) {
        throw new Error('No active stroke found');
      }
  
      this.strokes.push(stroke);
      this.currentStroke.delete(peerId);
  
      // Keep strokes count in check
      if (this.strokes.length > this.maxStrokes) {
        this.strokes = this.strokes.slice(-this.maxStrokes);
      }
  
      return stroke;
    }
  
    addShape(peerId, shape) {
      const shapeObj = {
        id: `${peerId}-${Date.now()}`,
        peerId,
        type: shape.type,
        properties: shape.properties,
        style: shape.style,
        timestamp: new Date().toISOString()
      };
  
      this.strokes.push(shapeObj);
  
      // Keep strokes count in check
      if (this.strokes.length > this.maxStrokes) {
        this.strokes = this.strokes.slice(-this.maxStrokes);
      }
  
      return shapeObj;
    }
  
    addText(peerId, textObj) {
      const text = {
        id: `${peerId}-${Date.now()}`,
        peerId,
        type: 'text',
        content: textObj.content,
        position: textObj.position,
        style: textObj.style,
        timestamp: new Date().toISOString()
      };
  
      this.strokes.push(text);
  
      // Keep strokes count in check
      if (this.strokes.length > this.maxStrokes) {
        this.strokes = this.strokes.slice(-this.maxStrokes);
      }
  
      return text;
    }
  
    undo(peerId) {
      for (let i = this.strokes.length - 1; i >= 0; i--) {
        if (this.strokes[i].peerId === peerId) {
          return this.strokes.splice(i, 1)[0];
        }
      }
      return null;
    }
  
    clear() {
      this.strokes = [];
      this.currentStroke.clear();
    }
  
    setBackground(color) {
      this.backgroundColor = color;
      return { backgroundColor: this.backgroundColor };
    }
  
    getState() {
      return {
        strokes: this.strokes,
        backgroundColor: this.backgroundColor,
        dimensions: {
          width: this.canvasWidth,
          height: this.canvasHeight
        }
      };
    }
  
    resize(width, height) {
      this.canvasWidth = width;
      this.canvasHeight = height;
      return {
        width: this.canvasWidth,
        height: this.canvasHeight
      };
    }
  }
  
  export default Whiteboard;