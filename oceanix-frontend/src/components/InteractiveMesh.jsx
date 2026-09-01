import React, { useRef, useEffect } from 'react'

export default function InteractiveMesh() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animationFrameId

    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const dots = []
    const spacing = 40 // Grid spacing
    const mouse = { x: -1000, y: -1000 }

    // Create grid points
    const init = () => {
      dots.length = 0
      for (let x = 0; x < width + spacing; x += spacing) {
        for (let y = 0; y < height + spacing; y += spacing) {
          dots.push({ x, y, originalX: x, originalY: y })
        }
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      ctx.strokeStyle = '#e2e8f0' // Light grid color
      ctx.lineWidth = 0.5

      // Loop through dots to apply physics
      dots.forEach((dot) => {
        const dx = mouse.x - dot.originalX
        const dy = mouse.y - dot.originalY
        const dist = Math.sqrt(dx * dx + dy * dy)
        const maxDist = 150 // Influence radius

        if (dist < maxDist) {
          const force = (maxDist - dist) / maxDist
          // Distortion effect: push points away from mouse
          dot.x = dot.originalX - dx * force * 0.4
          dot.y = dot.originalY - dy * force * 0.4
        } else {
          // Return to original position
          dot.x += (dot.originalX - dot.x) * 0.1
          dot.y += (dot.originalY - dot.y) * 0.1
        }
      })

      // Draw lines between dots (Grid Mesh)
      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i]
        // Check next dot in the column
        const nextCol = dots[i + 1]
        if (nextCol && nextCol.originalX === dot.originalX && Math.abs(nextCol.originalY - dot.originalY) <= spacing) {
          ctx.beginPath()
          ctx.moveTo(dot.x, dot.y)
          ctx.lineTo(nextCol.x, nextCol.y)
          ctx.stroke()
        }
        // Check dot in the next row
        const rowSize = Math.floor(height / spacing) + 1
        const nextRow = dots[i + rowSize]
        if (nextRow) {
          ctx.beginPath()
          ctx.moveTo(dot.x, dot.y)
          ctx.lineTo(nextRow.x, nextRow.y)
          ctx.stroke()
        }
      }

      animationFrameId = requestAnimationFrame(draw)
    }

    const handleMouseMove = (e) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
    }

    const handleResize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
      init()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('resize', handleResize)
    init()
    draw()

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />
}