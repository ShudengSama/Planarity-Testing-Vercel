export class GraphEditor {
    constructor() {
        this.nodes = [];
        this.edges = [];
        this.nodeIdCounter = 1;
        this.currentTool = 'select'; // select, node, edge
        this.selectedElement = null; // {type: 'node'|'edge', id: ...}
        this.tempEdge = null;

        this.container = d3.select("#editor-canvas");
        this.width = this.container.node().clientWidth;
        this.height = this.container.node().clientHeight;

        this.svg = this.container.append("svg")
            .attr("width", "100%")
            .attr("height", "100%");

        // Zoom Behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 10])
            .on("zoom", (event) => {
                this.g.attr("transform", event.transform);
            });

        this.svg.call(this.zoom)
            .on("dblclick.zoom", null)
            .on("click", (e) => this.handleCanvasClick(e))
            .on("mousemove", (e) => this.handleMouseMove(e));

        // Main Group for Zooming
        this.g = this.svg.append("g");

        this.edgeGroup = this.g.append("g").attr("class", "edges");
        this.nodeGroup = this.g.append("g").attr("class", "nodes");
        this.tempGroup = this.g.append("g").attr("class", "temp");

        this.bindEvents();
        this.setupKeyboard();
    }

    bindEvents() {
        // Toolbar
        d3.select("#tool-select").on("click", () => this.setTool('select'));
        d3.select("#tool-node").on("click", () => this.setTool('node'));
        d3.select("#tool-edge").on("click", () => this.setTool('edge'));

        d3.select("#tool-clear").on("click", () => {
            if (this.selectedElement) {
                this.deleteCurrentSelection();
            } else {
                this.clear();
            }
        });

        d3.select("#editor-export").on("click", () => this.exportGraph());

        // Zoom Controls
        const controls = d3.select("#controls-editor");
        controls.select(".zoom-in").on("click", () => {
            this.svg.transition().duration(300).call(this.zoom.scaleBy, 1.2);
        });
        controls.select(".zoom-out").on("click", () => {
            this.svg.transition().duration(300).call(this.zoom.scaleBy, 0.8);
        });
        controls.select(".reset-view").on("click", () => {
            this.svg.transition().duration(750).call(this.zoom.transform, d3.zoomIdentity);
        });

        // Resize observer
        new ResizeObserver(() => {
            this.width = this.container.node().clientWidth;
            this.height = this.container.node().clientHeight;
        }).observe(this.container.node());
    }

    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            const editorView = document.getElementById('editor-view');
            if (!editorView || editorView.classList.contains('hidden')) return;

            if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter') {
                this.deleteCurrentSelection();
            }
        });
    }

    deleteCurrentSelection() {
        if (this.selectedElement) {
            if (this.selectedElement.type === 'node') {
                this.deleteNode(this.selectedElement.data);
            } else if (this.selectedElement.type === 'edge') {
                this.deleteEdge(this.selectedElement.data);
            }
            this.selectedElement = null;
            this.render();
        }
    }

    setTool(tool) {
        this.currentTool = tool;
        d3.selectAll(".tool-btn").classed("active", false);
        d3.select(`#tool-${tool}`).classed("active", true);

        // Update cursor
        this.container.style("cursor", tool === 'select' ? 'default' : 'crosshair');

        // Clear selection when switching tools
        this.selectedElement = null;
        this.render();
    }

    handleCanvasClick(event) {
        if (event.target.tagName !== 'svg') return;

        if (this.currentTool === 'node') {
            // Get coordinates relative to the main group (handling zoom/pan)
            const [x, y] = d3.pointer(event, this.g.node());
            this.addNode(x, y);
        } else if (this.currentTool === 'select') {
            this.selectedElement = null;
            this.render();
        }
    }

    handleMouseMove(event) {
        if (this.currentTool === 'edge' && this.tempEdge) {
            const [x, y] = d3.pointer(event, this.g.node());
            this.tempGroup.select("line")
                .attr("x2", x)
                .attr("y2", y);
        }
    }

    addNode(x, y) {
        const newNode = {
            id: this.nodeIdCounter++,
            x: x,
            y: y
        };
        this.nodes.push(newNode);
        this.render();
    }

    deleteNode(node) {
        this.nodes = this.nodes.filter(n => n.id !== node.id);
        this.edges = this.edges.filter(e => e.source.id !== node.id && e.target.id !== node.id);
    }

    deleteEdge(edge) {
        this.edges = this.edges.filter(e => e !== edge);
    }

    startEdge(node) {
        this.tempEdge = { source: node };
        this.tempGroup.append("line")
            .attr("class", "temp-edge")
            .attr("x1", node.x)
            .attr("y1", node.y)
            .attr("x2", node.x)
            .attr("y2", node.y);
    }

    finishEdge(node) {
        if (this.tempEdge && this.tempEdge.source !== node) {
            // Check if edge already exists
            const exists = this.edges.some(e =>
                (e.source.id === this.tempEdge.source.id && e.target.id === node.id) ||
                (e.source.id === node.id && e.target.id === this.tempEdge.source.id)
            );

            if (!exists) {
                this.edges.push({
                    source: this.tempEdge.source,
                    target: node
                });
            }
        }
        this.cancelEdge();
        this.render();
    }

    cancelEdge() {
        this.tempEdge = null;
        this.tempGroup.selectAll("*").remove();
    }

    clear() {
        this.nodes = [];
        this.edges = [];
        this.nodeIdCounter = 1;
        this.selectedElement = null;
        this.render();
    }

    exportGraph() {
        if (this.edges.length === 0 && this.nodes.length === 0) return;

        let content = "";
        this.edges.forEach(e => {
            content += `${e.source.id} ${e.target.id}\n`;
        });

        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "graph.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    getGraphAsFile() {
        if (this.edges.length === 0 && this.nodes.length === 0) return null;

        let content = "";
        this.edges.forEach(e => {
            content += `${e.source.id} ${e.target.id}\n`;
        });

        const blob = new Blob([content], { type: "text/plain" });
        return new File([blob], "editor_graph.txt", { type: "text/plain" });
    }

    loadGraph(data) {
        this.clear();

        // Load nodes
        if (data.nodes) {
            data.nodes.forEach(n => {
                // Use backend coordinates if available, otherwise random or layout
                // Backend usually returns x,y scaled. Editor needs them to fit in canvas?
                // Editor canvas is 100% width/height.
                // Backend coordinates might be large (e.g. 500 scale).
                // We might need to rescale or just use them.
                // Let's use them directly for now, assuming they are reasonable or user can zoom/pan (wait, editor has no zoom/pan yet? It uses SVG but no zoom behavior attached to editor yet? 
                // Actually editor has no zoom. So we should probably center them.
                // But for now let's just use x,y.

                // If x,y missing, assign random
                const x = n.x !== undefined ? n.x : Math.random() * this.width;
                const y = n.y !== undefined ? n.y : Math.random() * this.height;

                this.nodes.push({
                    id: String(n.id), // Ensure string ID
                    x: x,
                    y: y
                });

                // Update counter to avoid ID collision if user adds more
                // Try to parse ID as int
                const idNum = parseInt(n.id);
                if (!isNaN(idNum) && idNum >= this.nodeIdCounter) {
                    this.nodeIdCounter = idNum + 1;
                }
            });
        }

        // Load edges
        if (data.edges) {
            data.edges.forEach(e => {
                const sourceNode = this.nodes.find(n => n.id === String(e.source));
                const targetNode = this.nodes.find(n => n.id === String(e.target));

                if (sourceNode && targetNode) {
                    this.edges.push({
                        source: sourceNode,
                        target: targetNode
                    });
                }
            });
        }

        this.render();
    }

    render() {
        // Update Clear/Delete Button
        const clearBtn = d3.select("#tool-clear");
        if (this.selectedElement) {
            clearBtn.attr("title", "Delete Selected")
                .html(`
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                   `);
        } else {
            clearBtn.attr("title", "Clear All")
                .html(`
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                   `);
        }

        // Edges
        this.edgeGroup.selectAll("line")
            .data(this.edges)
            .join("line")
            .attr("class", d => {
                const isSelected = this.selectedElement &&
                    this.selectedElement.type === 'edge' &&
                    this.selectedElement.data === d;
                return isSelected ? "editor-edge selected" : "editor-edge";
            })
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y)
            .on("click", (e, d) => {
                e.stopPropagation();
                if (this.currentTool === 'select') {
                    this.selectedElement = { type: 'edge', data: d };
                    this.render();
                }
            });

        // Nodes
        const nodes = this.nodeGroup.selectAll("g")
            .data(this.nodes, d => d.id)
            .join("g")
            .attr("class", d => {
                const isSelected = this.selectedElement &&
                    this.selectedElement.type === 'node' &&
                    this.selectedElement.data.id === d.id;
                return isSelected ? "editor-node selected" : "editor-node";
            })
            .attr("transform", d => `translate(${d.x},${d.y})`)
            .call(d3.drag()
                .on("start", (e, d) => {
                    if (this.currentTool !== 'select') return;
                    e.sourceEvent.stopPropagation();
                })
                .on("drag", (e, d) => {
                    if (this.currentTool !== 'select') return;
                    d.x = e.x;
                    d.y = e.y;
                    this.render(); // Re-render to update edges
                })
            );

        nodes.selectAll("circle").remove();
        nodes.selectAll("text").remove();

        nodes.append("circle")
            .attr("r", 15)
            .on("click", (e, d) => {
                e.stopPropagation();
                if (this.currentTool === 'edge') {
                    if (!this.tempEdge) {
                        this.startEdge(d);
                    } else {
                        this.finishEdge(d);
                    }
                } else if (this.currentTool === 'select') {
                    this.selectedElement = { type: 'node', data: d };
                    this.render();
                }
            });

        nodes.append("text")
            .attr("dy", 5)
            .attr("text-anchor", "middle")
            .style("fill", "white")
            .style("font-size", "12px")
            .style("pointer-events", "none")
            .text(d => d.id);
    }
}
