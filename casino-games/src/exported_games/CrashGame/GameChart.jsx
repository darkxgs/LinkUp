import { useRef, useEffect, useMemo, useCallback } from 'react'
import { Tag, Typography, Badge } from 'antd'
import { WifiOutlined } from '@ant-design/icons'
import { casinoAsset } from '../../config/assets.js'
import { t } from '../../i18n/casinoI18n.js'

const { Text, Title } = Typography

function GameChart({ phase, multiplier, elapsedTime, countdown, history = [], roundActive = false }) {
    const canvasRef = useRef(null)
    const rocketRef = useRef(null)
    const exhaustRef = useRef(null)
    const explosionRef = useRef(null)
    const starsRef = useRef([])
    // Cache canvas dimensions to avoid expensive getBoundingClientRect every frame
    const canvasSizeRef = useRef({ width: 0, height: 0, dpr: 1 })

    // Dynamic scaling for both axes
    const maxTime = useMemo(() => {
        return Math.max(elapsedTime + 2, 8)
    }, [elapsedTime])

    const maxMultiplier = useMemo(() => {
        return Math.max(multiplier * 1.3, 2)
    }, [multiplier])

    // Y-axis labels - throttle updates to reduce re-renders
    const yAxisLabels = useMemo(() => {
        const roundedMax = Math.round(maxMultiplier * 10) / 10
        const labels = []
        const steps = 5
        for (let i = steps; i >= 0; i--) {
            const value = 1 + ((roundedMax - 1) * i / steps)
            labels.push(value.toFixed(1))
        }
        return labels
    }, [Math.round(maxMultiplier * 10)])

    // X-axis labels
    const xAxisLabels = useMemo(() => {
        const roundedMax = Math.ceil(maxTime)
        const labels = []
        const step = Math.ceil(roundedMax / 4)
        for (let i = step; i <= roundedMax; i += step) {
            labels.push(i)
        }
        return labels
    }, [Math.ceil(maxTime)])

    // Handle canvas resize only when needed (not every frame)
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const dpr = window.devicePixelRatio || 1
                const { width, height } = entry.contentRect
                canvas.width = width * dpr
                canvas.height = height * dpr
                canvasSizeRef.current = { width, height, dpr }
            }
        })
        observer.observe(canvas)

        // Initial size
        const rect = canvas.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
        canvasSizeRef.current = { width: rect.width, height: rect.height, dpr }

        // Initialize stars
        const stars = []
        for(let i=0; i<150; i++) {
            stars.push({
                x: Math.random(),
                y: Math.random(),
                size: Math.random() * 2 + 0.5,
                speed: Math.random() * 0.003 + 0.001
            })
        }
        starsRef.current = stars

        return () => observer.disconnect()
    }, [])

    // Draw chart - optimized
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        const { width, height, dpr } = canvasSizeRef.current
        if (width === 0 || height === 0) return

        // Reset transform and clear
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, width, height)

        // Draw dynamic starfield
        const stars = starsRef.current;
        const speedMult = phase === 'running' ? Math.max(1, elapsedTime * 2) : 0.5;
        
        ctx.fillStyle = '#ffffff';
        stars.forEach((star, index) => {
            if (phase === 'running') {
                star.x -= star.speed * speedMult * 0.8; // move left
                star.y += star.speed * speedMult;       // move down
                if (star.x < 0) star.x = 1;
                if (star.y > 1) star.y = 0;
            }
            // Twinkle effect
            ctx.globalAlpha = (Math.sin(Date.now() * 0.002 + index) * 0.4 + 0.6) * 0.8;
            ctx.beginPath();
            ctx.arc(star.x * width, star.y * height, star.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1.0;

        const padding = { left: 20, right: 50, top: 60, bottom: 20 }
        const chartWidth = width - padding.left - padding.right
        const chartHeight = height - padding.top - padding.bottom

        // Helper functions
        const timeToX = (time) => padding.left + (time / maxTime) * chartWidth
        const multiplierToY = (mult) => {
            const normalized = (mult - 1) / (maxMultiplier - 1)
            return height - padding.bottom - normalized * chartHeight
        }

        // Draw grid dots instead of lines
        ctx.fillStyle = '#ffffff';
        // Horizontal dots along bottom edge
        for (let i = 0; i <= 20; i++) {
            const x = padding.left + (chartWidth * i / 20);
            ctx.beginPath();
            ctx.arc(x, height - padding.bottom, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        // Vertical dots along left edge
        for (let i = 0; i <= 10; i++) {
            const y = padding.top + (chartHeight * i / 10);
            ctx.beginPath();
            ctx.arc(padding.left, y, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw curve when game is running or crashed
        if ((phase === 'running' || phase === 'crashed') && elapsedTime > 0) {
            // OPTIMIZED: Cap points at 200 max, use adaptive sampling
            const numPoints = Math.min(200, Math.max(80, Math.floor(elapsedTime * 20)))
            const points = new Array(numPoints + 1)

            for (let i = 0; i <= numPoints; i++) {
                const t = i / numPoints
                const currentTime = elapsedTime * t
                const currentMult = Math.pow(Math.E, 0.1 * currentTime)
                const x = timeToX(currentTime)
                const y = Math.max(padding.top, multiplierToY(currentMult))
                points[i] = { x, y }
            }

            // Gradient fill under curve (single draw call)
            const fillGradient = ctx.createLinearGradient(
                padding.left, height - padding.bottom,
                timeToX(elapsedTime), multiplierToY(multiplier)
            )

            if (phase === 'crashed') {
                fillGradient.addColorStop(0, 'rgba(255, 0, 76, 0.05)')
                fillGradient.addColorStop(0.5, 'rgba(255, 0, 76, 0.3)')
                fillGradient.addColorStop(1, 'rgba(255, 0, 76, 0.6)')
            } else {
                fillGradient.addColorStop(0, 'rgba(255, 0, 102, 0.05)')
                fillGradient.addColorStop(0.3, 'rgba(255, 0, 102, 0.2)')
                fillGradient.addColorStop(0.6, 'rgba(255, 0, 102, 0.4)')
                fillGradient.addColorStop(1, 'rgba(255, 0, 102, 0.7)')
            }

            ctx.beginPath()
            ctx.moveTo(padding.left, height - padding.bottom)
            ctx.lineTo(points[0].x, points[0].y)
            for (let i = 1; i <= numPoints; i++) {
                ctx.lineTo(points[i].x, points[i].y)
            }
            ctx.lineTo(points[numPoints].x, height - padding.bottom)
            ctx.closePath()
            ctx.fillStyle = fillGradient
            ctx.fill()

            // OPTIMIZED: Single glow layer instead of 3 separate ones
            const lineColor = phase === 'crashed' ? '#990000' : '#ff004c'

            ctx.beginPath()
            ctx.moveTo(points[0].x, points[0].y)
            for (let i = 1; i <= numPoints; i++) {
                ctx.lineTo(points[i].x, points[i].y)
            }
            ctx.strokeStyle = phase === 'crashed'
                ? 'rgba(255, 0, 76, 0.2)'
                : 'rgba(255, 0, 102, 0.3)'
            ctx.lineWidth = 12
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.shadowColor = lineColor
            ctx.shadowBlur = 10
            ctx.stroke()

            // Main line with gradient (no shadow for performance)
            ctx.shadowBlur = 0
            const lineGradient = ctx.createLinearGradient(
                padding.left, 0,
                timeToX(elapsedTime), 0
            )
            if (phase === 'crashed') {
                lineGradient.addColorStop(0, '#cc003d')
                lineGradient.addColorStop(1, '#66001f')
            } else {
                lineGradient.addColorStop(0, '#ff0066')
                lineGradient.addColorStop(0.5, '#ff1a75')
                lineGradient.addColorStop(1, '#ff4d94')
            }

            ctx.beginPath()
            ctx.moveTo(points[0].x, points[0].y)
            for (let i = 1; i <= numPoints; i++) {
                ctx.lineTo(points[i].x, points[i].y)
            }
            ctx.strokeStyle = lineGradient
            ctx.lineWidth = 4
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.stroke()

            // Draw endpoint calculations
            const endX = timeToX(elapsedTime)
            const endY = multiplierToY(multiplier)

            // Calculate rotation angle
            let angle = 0
            if (numPoints >= 2) {
                const p1 = points[Math.max(0, numPoints - 10)]
                const p2 = points[numPoints]
                angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
            }

            // HTML overlay sync moved outside
        } // End of running/crashed curve block

        // --- ALWAYS update HTML overlays (Sync to canvas) ---
        if (rocketRef.current) {
            if (phase === 'running') {
                const endX = timeToX(elapsedTime)
                const endY = multiplierToY(multiplier)
                
                let angle = 0
                const numPoints = Math.min(200, Math.max(80, Math.floor(elapsedTime * 20)))
                if (numPoints >= 2) {
                    const t1 = Math.max(0, elapsedTime - 0.5)
                    const x1 = timeToX(t1)
                    const y1 = multiplierToY(Math.pow(Math.E, 0.1 * t1))
                    angle = Math.atan2(endY - y1, endX - x1)
                }

                rocketRef.current.style.display = 'block'
                rocketRef.current.style.left = `${endX}px`
                rocketRef.current.style.top = `${endY}px`
                rocketRef.current.style.transform = `translate(-50%, -50%) rotate(${angle}rad) rotate(90deg)`

                if (exhaustRef.current) {
                    exhaustRef.current.style.display = 'block'
                    exhaustRef.current.style.left = `${endX}px`
                    exhaustRef.current.style.top = `${endY}px`
                    exhaustRef.current.style.transform = `translate(-50%, -50%) rotate(${angle}rad) rotate(90deg) translate(0px, 95px)`
                }
            } else if (phase === 'waiting' || (phase === 'crashed' && elapsedTime === 0)) {
                // Show rocket resting at the start position (horizontal)
                rocketRef.current.style.display = 'block'
                rocketRef.current.style.left = `${padding.left}px`
                rocketRef.current.style.top = `${height - padding.bottom}px`
                rocketRef.current.style.transform = `translate(-50%, -50%) rotate(0rad) rotate(90deg)`

                if (exhaustRef.current) exhaustRef.current.style.display = 'none'
            } else {
                rocketRef.current.style.display = 'none'
                if (exhaustRef.current) exhaustRef.current.style.display = 'none'
            }
        }

        if (explosionRef.current) {
            if (phase === 'crashed' && elapsedTime > 0) {
                if (explosionRef.current.style.display !== 'block') {
                    explosionRef.current.style.display = 'block'
                    explosionRef.current.style.left = `${timeToX(elapsedTime)}px`
                    explosionRef.current.style.top = `${multiplierToY(multiplier)}px`
                    explosionRef.current.src = casinoAsset('/images/explosions/normal_explosion.gif') + '?' + Date.now()

                    setTimeout(() => {
                        if (explosionRef.current) {
                            explosionRef.current.style.display = 'none'
                        }
                    }, 1000)
                }
            } else {
                explosionRef.current.style.display = 'none'
            }
        }
    }, [phase, multiplier, elapsedTime, maxTime, maxMultiplier])

    const getStatusText = () => {
        if (phase === 'waiting' && !roundActive) return t('setBetAndStart')
        if (phase === 'waiting') return t('launchIn', { sec: countdown.toFixed(1) })
        if (phase === 'crashed') return t('crashedAt', { mult: multiplier.toFixed(2) })
        return null
    }

    const getMultiplierColor = () => {
        if (phase === 'crashed') return '#ed4245'
        if (multiplier >= 10) return '#00f0ff'
        if (multiplier >= 5) return '#ffc107'
        if (multiplier >= 2) return '#f7931a'
        return '#ffffff'
    }

    return (
        <div className="game-chart-container" style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flex: 1 }}>
            <canvas ref={canvasRef} className="crash-canvas" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block' }} />

            {/* In-game Overlay Assets - will-change for GPU compositing */}
            <img
                ref={rocketRef}
                src={casinoAsset('/images/red_plane.svg')}
                alt="Plane"
                style={{ position: 'absolute', width: '80px', height: 'auto', pointerEvents: 'none', zIndex: 10, filter: 'drop-shadow(0 0 10px rgba(255, 0, 76, 0.8))', willChange: 'transform, left, top' }}
            />
            <img
                ref={exhaustRef}
                src={casinoAsset('/images/exhaust/exhaust02_preview.gif')}
                alt="Exhaust"
                style={{ position: 'absolute', width: '150px', height: 'auto', display: 'none', pointerEvents: 'none', zIndex: 9, mixBlendMode: 'screen', filter: 'hue-rotate(340deg) saturate(2)', imageRendering: 'pixelated', willChange: 'transform, left, top' }}
            />
            <img
                ref={explosionRef}
                src={casinoAsset('/images/explosions/normal_explosion.gif')}
                alt="Explosion"
                style={{ position: 'absolute', width: '250px', height: 'auto', display: 'none', pointerEvents: 'none', zIndex: 11, transform: 'translate(-50%, -50%)', mixBlendMode: 'screen', imageRendering: 'pixelated' }}
            />

            {/* Top History Bar */}
            <div className="clone-history-bar" style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex', gap: '8px', overflow: 'hidden' }}>
                {history.slice(0, 10).map((h, i) => {
                    const color = h < 1.2 ? '#f87171' : h < 2 ? '#4ade80' : h < 10 ? '#60a5fa' : '#fbbf24';
                    return (
                        <span key={i} style={{ color, fontSize: 13, fontWeight: 'bold', background: 'rgba(0,0,0,0.4)', padding: '2px 8px', borderRadius: 4 }}>
                            x{h.toFixed(2)}
                        </span>
                    )
                })}
            </div>

            {/* Fixed Overlay Container for Multiplier to prevent vertical shifting */}
            <div style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 20 }}>
                <Title
                    level={1}
                    style={{
                        color: '#ffffff',
                        margin: 0,
                        fontSize: 'clamp(60px, 15vw, 120px)',
                        fontWeight: 800,
                        letterSpacing: '-2px',
                        textShadow: phase === 'crashed' ? 'none' : '0 0 40px rgba(255,255,255,0.2)',
                        transition: 'none',
                        fontFamily: "'Inter', -apple-system, sans-serif",
                        fontVariantNumeric: 'tabular-nums',
                        lineHeight: 1,
                        textAlign: 'center',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {multiplier.toFixed(2)}x
                </Title>
            </div>

            {/* Separate Overlay Container for Status Message so it doesn't push the multiplier */}
            {(phase === 'waiting' || phase === 'crashed') && (
                <div style={{ position: 'absolute', top: '65%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 20 }}>
                    <Tag
                        color={phase === 'crashed' ? 'error' : 'warning'}
                        style={{
                            fontSize: 15,
                            padding: '8px 24px',
                            borderRadius: 24,
                            fontWeight: 600,
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase'
                        }}
                    >
                        {getStatusText()}
                    </Tag>
                </div>
            )}
        </div>
    )
}

export default GameChart
