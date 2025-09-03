import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'

function App() {
  // 단계 관리
  const [currentStep, setCurrentStep] = useState('canvas') // 'imageAdjust' 또는 'canvas'
  
  // 캔버스 관련 상태
  const [currentTool, setCurrentTool] = useState('select')
  const [pixelGrid, setPixelGrid] = useState({}) // 픽셀별 색상 저장
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 100, y: 100 })
  const [showDetailGrid, setShowDetailGrid] = useState(false)
  
  // 색상 설정
  const [selectedColor, setSelectedColor] = useState('#228b22')
  const [pixelSize, setPixelSize] = useState(1) // 픽셀 브러시 크기
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 })
  const [showCustomCursor, setShowCustomCursor] = useState(false)
  
  // 이미지 조정 관련 상태
  const [originalImage, setOriginalImage] = useState(null)
  const [croppedBackground, setCroppedBackground] = useState(null)
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 })
  const [imageScale, setImageScale] = useState(1)
  const [isDraggingImage, setIsDraggingImage] = useState(false)
  
  const canvasRef = useRef(null)
  const adjustCanvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const loadInputRef = useRef(null)
  const isDragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const currentPath = useRef([])
  
  const CELL_SIZE = 80 // 격자 크기를 크게 조정
  const DETAIL_GRID_SIZE = 16
  const DETAIL_SCALE_THRESHOLD = 2
  
  // 색상 팔레트
  const COLOR_PALETTE = [
    { name: '도로', color: '#d2b48c' },
    { name: '모래사장', color: '#f4e4bc' }, 
    { name: '강줄기', color: '#87ceeb' },
    { name: '섬바닥', color: '#228b22' },
    { name: '1층 절벽', color: '#32cd32' },
    { name: '2층 절벽', color: '#90ee90' },
    { name: '암석', color: '#36454f' },
    { name: '자유색상', color: selectedColor }
  ]
  
  // 커스텀 커서 생성 함수
  const generateCustomCursor = useCallback((size, color) => {
    const canvas = document.createElement('canvas')
    const pixelDisplaySize = Math.floor(CELL_SIZE / DETAIL_GRID_SIZE * scale)
    const cursorSize = Math.max(size * pixelDisplaySize, 4) // 최소 4px
    
    canvas.width = cursorSize + 2
    canvas.height = cursorSize + 2
    
    const ctx = canvas.getContext('2d')
    
    // 반투명 배경
    ctx.fillStyle = color + '80'
    ctx.fillRect(1, 1, cursorSize, cursorSize)
    
    // 테두리
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, 0.5, cursorSize + 1, cursorSize + 1)
    
    return `url(${canvas.toDataURL()}) ${Math.floor(cursorSize/2)+1} ${Math.floor(cursorSize/2)+1}, crosshair`
  }, [scale])
  
  // Canvas 그리기 함수들
  const drawGrid = useCallback((ctx) => {
    const gridWidth = 7 * CELL_SIZE
    const gridHeight = 6 * CELL_SIZE
    
    ctx.save()
    ctx.scale(scale, scale)
    ctx.translate(offset.x / scale, offset.y / scale)
    
    // 배경
    ctx.fillStyle = croppedBackground ? 'rgba(168, 216, 168, 0.3)' : '#a8d8a8'
    ctx.fillRect(0, 0, gridWidth, gridHeight)
    
    // 세부 격자 (먼저 그리기)
    if (showDetailGrid) {
      ctx.strokeStyle = '#87ceeb'
      ctx.lineWidth = 0.5
      ctx.globalAlpha = 0.6
      
      const detailCellSize = CELL_SIZE / DETAIL_GRID_SIZE
      
      // 세부 세로선
      for (let mainCol = 0; mainCol < 7; mainCol++) {
        for (let detailCol = 1; detailCol < DETAIL_GRID_SIZE; detailCol++) {
          const x = mainCol * CELL_SIZE + detailCol * detailCellSize
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, gridHeight)
          ctx.stroke()
        }
      }
      
      // 세부 가로선
      for (let mainRow = 0; mainRow < 6; mainRow++) {
        for (let detailRow = 1; detailRow < DETAIL_GRID_SIZE; detailRow++) {
          const y = mainRow * CELL_SIZE + detailRow * detailCellSize
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(gridWidth, y)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
    }
    
    // 기본 격자
    ctx.strokeStyle = '#4a90e2'
    ctx.lineWidth = 2
    
    // 세로선
    for (let i = 0; i <= 7; i++) {
      ctx.beginPath()
      ctx.moveTo(i * CELL_SIZE, 0)
      ctx.lineTo(i * CELL_SIZE, gridHeight)
      ctx.stroke()
    }
    
    // 가로선
    for (let i = 0; i <= 6; i++) {
      ctx.beginPath()
      ctx.moveTo(0, i * CELL_SIZE)
      ctx.lineTo(gridWidth, i * CELL_SIZE)
      ctx.stroke()
    }
    
    // 테두리
    ctx.lineWidth = 3
    ctx.strokeRect(0, 0, gridWidth, gridHeight)
    
    ctx.restore()
  }, [scale, offset, showDetailGrid, croppedBackground])
  
  const drawBackgroundImage = useCallback((ctx) => {
    if (!croppedBackground) return
    
    ctx.save()
    ctx.scale(scale, scale)
    ctx.translate(offset.x / scale, offset.y / scale)
    
    const gridWidth = 7 * CELL_SIZE
    const gridHeight = 6 * CELL_SIZE
    ctx.drawImage(croppedBackground, 0, 0, gridWidth, gridHeight)
    
    ctx.restore()
  }, [croppedBackground, scale, offset])
  
  // 이미지 조정 캔버스 그리기 함수들
  const drawImageAdjustCanvas = useCallback(() => {
    const canvas = adjustCanvasRef.current
    if (!canvas || !originalImage) return
    
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // 배경 (어둡게)
    ctx.fillStyle = '#f0f0f0'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // 7x6 격자 영역 표시
    const gridWidth = 7 * CELL_SIZE
    const gridHeight = 6 * CELL_SIZE
    const gridX = (canvas.width - gridWidth) / 2
    const gridY = (canvas.height - gridHeight) / 2
    
    // 격자 영역 배경
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(gridX, gridY, gridWidth, gridHeight)
    
    // 격자 그리기
    ctx.strokeStyle = '#4a90e2'
    ctx.lineWidth = 2
    
    // 세로선
    for (let i = 0; i <= 7; i++) {
      ctx.beginPath()
      ctx.moveTo(gridX + i * CELL_SIZE, gridY)
      ctx.lineTo(gridX + i * CELL_SIZE, gridY + gridHeight)
      ctx.stroke()
    }
    
    // 가로선
    for (let i = 0; i <= 6; i++) {
      ctx.beginPath()
      ctx.moveTo(gridX, gridY + i * CELL_SIZE)
      ctx.lineTo(gridX + gridWidth, gridY + i * CELL_SIZE)
      ctx.stroke()
    }
    
    // 이미지 그리기
    ctx.globalAlpha = 0.8
    ctx.drawImage(
      originalImage,
      gridX + imagePosition.x,
      gridY + imagePosition.y,
      originalImage.width * imageScale,
      originalImage.height * imageScale
    )
    ctx.globalAlpha = 1
    
    // 격자 테두리 (이미지 위에)
    ctx.strokeStyle = '#e74c3c'
    ctx.lineWidth = 3
    ctx.strokeRect(gridX, gridY, gridWidth, gridHeight)
    
  }, [originalImage, imagePosition, imageScale])
  
  const drawPixelGrid = useCallback((ctx) => {
    ctx.save()
    ctx.scale(scale, scale)
    ctx.translate(offset.x / scale, offset.y / scale)
    
    const pixelSize = CELL_SIZE / DETAIL_GRID_SIZE // 5px per pixel
    
    Object.entries(pixelGrid).forEach(([key, color]) => {
      const [x, y] = key.split(',').map(Number)
      ctx.fillStyle = color
      ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize)
    })
    
    ctx.restore()
  }, [pixelGrid, scale, offset])
  
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    drawBackgroundImage(ctx)
    drawGrid(ctx)
    drawPixelGrid(ctx)
  }, [drawGrid, drawBackgroundImage, drawPixelGrid])
  
  useEffect(() => {
    if (currentStep === 'canvas') {
      redraw()
    } else if (currentStep === 'imageAdjust') {
      drawImageAdjustCanvas()
    }
  }, [redraw, drawImageAdjustCanvas, currentStep])

  // 페이지 전체 스크롤 확대 방지
  useEffect(() => {
    const preventPageZoom = (e) => {
      // 캔버스 영역에서만 wheel 이벤트 허용
      const canvas = canvasRef.current
      const adjustCanvas = adjustCanvasRef.current
      
      // 캔버스 영역이면 캔버스 전용 줌만 허용
      if (canvas && canvas.contains(e.target)) {
        // 브라우저 기본 확대 방지
        if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 100) {
          e.preventDefault()
        }
        return
      }
      if (adjustCanvas && adjustCanvas.contains(e.target)) {
        e.preventDefault()
        return
      }
      
      // 다른 모든 영역에서 wheel 이벤트 완전 차단
      e.preventDefault()
    }

    document.addEventListener('wheel', preventPageZoom, { passive: false })
    document.addEventListener('touchmove', (e) => {
      // 트랙패드 핀치 줌 방지
      if (e.touches.length > 1) {
        e.preventDefault()
      }
    }, { passive: false })
    
    return () => {
      document.removeEventListener('wheel', preventPageZoom)
    }
  }, [currentStep])

  // 이미지 조정 모드에서 키보드 조작
  useEffect(() => {
    if (currentStep !== 'imageAdjust') return

    const handleKeyDown = (e) => {
      const moveStep = e.shiftKey ? 10 : 1 // Shift 키로 큰 단위 이동
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          adjustImagePosition(0, -moveStep)
          break
        case 'ArrowDown':
          e.preventDefault()
          adjustImagePosition(0, moveStep)
          break
        case 'ArrowLeft':
          e.preventDefault()
          adjustImagePosition(-moveStep, 0)
          break
        case 'ArrowRight':
          e.preventDefault()
          adjustImagePosition(moveStep, 0)
          break
        case '=':
        case '+':
          e.preventDefault()
          adjustImageScale(e.shiftKey ? 0.1 : 0.01)
          break
        case '-':
          e.preventDefault()
          adjustImageScale(e.shiftKey ? -0.1 : -0.01)
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [currentStep])
  
  // 이미지 조정 모드 이벤트 핸들러들
  const getImageAdjustPos = (e) => {
    const canvas = adjustCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const gridWidth = 7 * CELL_SIZE
    const gridHeight = 6 * CELL_SIZE
    const gridX = (canvas.width - gridWidth) / 2
    const gridY = (canvas.height - gridHeight) / 2
    
    return {
      x: e.clientX - rect.left - gridX,
      y: e.clientY - rect.top - gridY
    }
  }

  const handleImageAdjustMouseDown = (e) => {
    if (!originalImage) return
    
    const pos = getImageAdjustPos(e)
    const imgX = imagePosition.x
    const imgY = imagePosition.y
    const imgWidth = originalImage.width * imageScale
    const imgHeight = originalImage.height * imageScale
    
    if (pos.x >= imgX && pos.x <= imgX + imgWidth && 
        pos.y >= imgY && pos.y <= imgY + imgHeight) {
      setIsDraggingImage(true)
      lastPos.current = { x: e.clientX, y: e.clientY }
    }
  }

  const handleImageAdjustMouseMove = (e) => {
    if (isDraggingImage) {
      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      setImagePosition(prev => ({ 
        x: prev.x + dx, 
        y: prev.y + dy 
      }))
      lastPos.current = { x: e.clientX, y: e.clientY }
    }
  }

  const handleImageAdjustMouseUp = () => {
    setIsDraggingImage(false)
  }

  // 캔버스 모드 이벤트 핸들러들
  const getCanvasPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left - offset.x) / scale,
      y: (e.clientY - rect.top - offset.y) / scale
    }
  }
  
  const handleMouseDown = (e) => {
    const pos = getCanvasPos(e)
    
    if (currentTool === 'select') {
      isDragging.current = true
      lastPos.current = { x: e.clientX, y: e.clientY }
    } else if (currentTool === 'paint') {
      if (e.button === 0) { // 좌클릭
        paintPixel(pos.x, pos.y)
      } else if (e.button === 2) { // 우클릭
        erasePixel(pos.x, pos.y)
      }
    }
  }

  const handleContextMenu = (e) => {
    e.preventDefault() // 우클릭 메뉴 방지
  }
  
  const handleMouseEnter = () => {
    if (currentTool === 'paint') {
      setShowCustomCursor(true)
    }
  }
  
  const handleMouseLeave = () => {
    setShowCustomCursor(false)
  }
  
  const handleMouseMove = (e) => {
    if (isDragging.current && currentTool === 'select') {
      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
      lastPos.current = { x: e.clientX, y: e.clientY }
    }
    
    // 페인트 모드에서 커서 위치 추적
    if (currentTool === 'paint') {
      const canvas = canvasRef.current
      if (canvas) {
        const rect = canvas.getBoundingClientRect()
        setCursorPosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        })
      }
    }
  }
  
  const handleMouseUp = () => {
    if (isDragging.current) {
      isDragging.current = false
    }
  }
  
  const handleWheel = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const scaleBy = 1.1
    const newScale = e.deltaY < 0 ? scale * scaleBy : scale / scaleBy
    
    setScale(Math.max(1, Math.min(5, newScale)))
    setShowDetailGrid(newScale >= DETAIL_SCALE_THRESHOLD)
  }

  // 이미지 조정 기능들
  const handleImageScaleInput = (value) => {
    const newScale = parseFloat(value)
    if (!isNaN(newScale) && newScale > 0) {
      setImageScale(Math.max(0.1, Math.min(10, newScale)))
    }
  }

  const adjustImageScale = (delta) => {
    setImageScale(prev => Math.max(0.1, Math.min(10, prev + delta)))
  }

  const adjustImagePosition = (dx, dy) => {
    setImagePosition(prev => ({ 
      x: prev.x + dx, 
      y: prev.y + dy 
    }))
  }

  const cropImageToGrid = () => {
    if (!originalImage) return null
    
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const gridWidth = 7 * CELL_SIZE
    const gridHeight = 6 * CELL_SIZE
    
    canvas.width = gridWidth
    canvas.height = gridHeight
    
    // 이미지 그리기 (격자 영역만)
    ctx.drawImage(
      originalImage,
      imagePosition.x,
      imagePosition.y,
      originalImage.width * imageScale,
      originalImage.height * imageScale
    )
    
    return canvas
  }

  const confirmImageAdjustment = () => {
    const croppedCanvas = cropImageToGrid()
    if (croppedCanvas) {
      setCroppedBackground(croppedCanvas)
      setCurrentStep('canvas')
    }
  }
  
  // 픽셀 페인팅 함수
  const paintPixel = (canvasX, canvasY) => {
    const unitPixelSize = CELL_SIZE / DETAIL_GRID_SIZE
    const gridWidth = 7 * CELL_SIZE
    const gridHeight = 6 * CELL_SIZE
    
    // 중심 픽셀 좌표 계산
    const centerPixelX = Math.floor(canvasX / unitPixelSize)
    const centerPixelY = Math.floor(canvasY / unitPixelSize)
    
    const newPixels = {}
    
    // pixelSize에 따른 영역 칠하기
    const half = Math.floor(pixelSize / 2)
    
    for (let dx = -half; dx < pixelSize - half; dx++) {
      for (let dy = -half; dy < pixelSize - half; dy++) {
        const pixelX = centerPixelX + dx
        const pixelY = centerPixelY + dy
        
        // 격자 범위 내에서만 페인팅
        const realX = pixelX * unitPixelSize
        const realY = pixelY * unitPixelSize
        
        if (realX >= 0 && realX < gridWidth && realY >= 0 && realY < gridHeight) {
          const key = `${pixelX},${pixelY}`
          newPixels[key] = selectedColor
        }
      }
    }
    
    setPixelGrid(prev => ({
      ...prev,
      ...newPixels
    }))
  }
  
  // 색상 선택
  const selectColor = (color) => {
    setSelectedColor(color)
  }
  
  // 픽셀 지우기 (우클릭)
  const erasePixel = (canvasX, canvasY) => {
    const unitPixelSize = CELL_SIZE / DETAIL_GRID_SIZE
    const gridWidth = 7 * CELL_SIZE
    const gridHeight = 6 * CELL_SIZE
    
    // 중심 픽셀 좌표 계산
    const centerPixelX = Math.floor(canvasX / unitPixelSize)
    const centerPixelY = Math.floor(canvasY / unitPixelSize)
    
    const keysToDelete = []
    
    // pixelSize에 따른 영역 지우기
    const half = Math.floor(pixelSize / 2)
    
    for (let dx = -half; dx < pixelSize - half; dx++) {
      for (let dy = -half; dy < pixelSize - half; dy++) {
        const pixelX = centerPixelX + dx
        const pixelY = centerPixelY + dy
        
        // 격자 범위 내에서만 지우기
        const realX = pixelX * unitPixelSize
        const realY = pixelY * unitPixelSize
        
        if (realX >= 0 && realX < gridWidth && realY >= 0 && realY < gridHeight) {
          const key = `${pixelX},${pixelY}`
          keysToDelete.push(key)
        }
      }
    }
    
    setPixelGrid(prev => {
      const newGrid = { ...prev }
      keysToDelete.forEach(key => delete newGrid[key])
      return newGrid
    })
  }
  
  const handleImageUpload = (event) => {
    const file = event.target.files[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          setOriginalImage(img)
          setCurrentStep('imageAdjust')
          // 이미지를 격자 중앙에 배치
          const gridWidth = 7 * CELL_SIZE
          const gridHeight = 6 * CELL_SIZE
          setImagePosition({ 
            x: (gridWidth - img.width * 0.8) / 2, 
            y: (gridHeight - img.height * 0.8) / 2 
          })
          setImageScale(0.8) // 초기 크기를 80%로 설정
        }
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
    }
    // 파일 입력 리셋
    event.target.value = ''
  }
  
  const saveProject = () => {
    const projectData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      croppedBackground: croppedBackground ? croppedBackground.toDataURL() : null,
      pixelGrid,
      scale,
      offset
    }
    
    const dataStr = JSON.stringify(projectData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    const exportFileDefaultName = `acnh-island-${new Date().toISOString().split('T')[0]}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }
  
  const loadProject = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const projectData = JSON.parse(e.target.result)
          setPixelGrid(projectData.pixelGrid || {})
          setScale(projectData.scale || 1)
          setOffset(projectData.offset || { x: 100, y: 100 })
          
          if (projectData.croppedBackground) {
            const img = new Image()
            img.onload = () => setCroppedBackground(img)
            img.src = projectData.croppedBackground
          }
          
          alert('프로젝트가 성공적으로 불러와졌습니다!')
        } catch (error) {
          alert('파일을 불러오는 중 오류가 발생했습니다.')
          console.error('Load error:', error)
        }
      }
      reader.readAsText(file)
    }
  }

  if (currentStep === 'imageAdjust') {
    return (
      <div className="app">
        <header className="header">
          <h1>🏝 모동숲 섬 꾸미기 - 이미지 조정</h1>
          <div className="header-controls">
            <button onClick={() => setCurrentStep('canvas')} className="back-button">
              ← 뒤로 가기
            </button>
            <button onClick={confirmImageAdjustment} className="confirm-button">
              조정 완료
            </button>
          </div>
        </header>
        
        <div className="main-container">
          <div className="toolbar">
            <h3>이미지 조정</h3>
            
            <div className="adjust-section">
              <h4>크기 조정</h4>
              <div className="scale-controls">
                <button onClick={() => adjustImageScale(-0.01)}>-0.01</button>
                <button onClick={() => adjustImageScale(-0.1)}>-0.1</button>
                <input
                  type="number"
                  value={imageScale.toFixed(2)}
                  onChange={(e) => handleImageScaleInput(e.target.value)}
                  step="0.01"
                  min="0.1"
                  max="10"
                  className="scale-input"
                />
                <button onClick={() => adjustImageScale(0.1)}>+0.1</button>
                <button onClick={() => adjustImageScale(0.01)}>+0.01</button>
              </div>
              
              <div className="preset-buttons">
                <button onClick={() => setImageScale(0.5)}>50%</button>
                <button onClick={() => setImageScale(1.0)}>100%</button>
                <button onClick={() => setImageScale(1.5)}>150%</button>
                <button onClick={() => setImageScale(2.0)}>200%</button>
              </div>
            </div>
            
            <div className="adjust-section">
              <h4>위치 조정</h4>
              <div className="position-controls">
                <div className="direction-pad">
                  <button onClick={() => adjustImagePosition(0, -10)}>↑</button>
                  <div className="horizontal-controls">
                    <button onClick={() => adjustImagePosition(-10, 0)}>←</button>
                    <span className="center-info">위치</span>
                    <button onClick={() => adjustImagePosition(10, 0)}>→</button>
                  </div>
                  <button onClick={() => adjustImagePosition(0, 10)}>↓</button>
                </div>
                
                <div className="fine-controls">
                  <h5>미세 조정</h5>
                  <div className="fine-pad">
                    <button onClick={() => adjustImagePosition(0, -1)}>↑</button>
                    <div className="horizontal-controls">
                      <button onClick={() => adjustImagePosition(-1, 0)}>←</button>
                      <span className="fine-info">1px</span>
                      <button onClick={() => adjustImagePosition(1, 0)}>→</button>
                    </div>
                    <button onClick={() => adjustImagePosition(0, 1)}>↓</button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="info-section">
              <h4 style={{color: '#e74c3c', marginBottom: '10px'}}>📐 조정 방법</h4>
              <p>• 드래그: 마우스로 위치 이동</p>
              <p>• 화살표 키: 위치 이동 (Shift로 10px)</p>
              <p>• +/- 키: 크기 조정 (Shift로 0.1 단위)</p>
              <p>• 빨간 테두리: 최종 격자 영역</p>
              <p style={{fontSize: '11px', color: '#7f8c8d', marginTop: '10px'}}>
                이미지를 격자에 맞춰 조정한 후 '조정 완료'를 클릭하세요
              </p>
            </div>
          </div>
          
          <div className="canvas-container">
            <canvas
              ref={adjustCanvasRef}
              width={window.innerWidth - 300}
              height={window.innerHeight - 100}
              onMouseDown={handleImageAdjustMouseDown}
              onMouseMove={handleImageAdjustMouseMove}
              onMouseUp={handleImageAdjustMouseUp}
              style={{ 
                cursor: 'move',
                border: '1px solid #ccc'
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🏝 모동숲 섬 꾸미기</h1>
        <div className="header-controls">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />
          <input
            ref={loadInputRef}
            type="file"
            accept=".json"
            onChange={loadProject}
            style={{ display: 'none' }}
          />
          <button onClick={() => fileInputRef.current.click()}>이미지 업로드</button>
          <button onClick={saveProject}>저장</button>
          <button onClick={() => loadInputRef.current.click()}>불러오기</button>
        </div>
      </header>
      
      <div className="main-container">
        <div className="toolbar">
          <h3>도구</h3>
          <div className="tool-section">
            <button 
              className={`tool-button ${currentTool === 'select' ? 'active' : ''}`}
              onClick={() => setCurrentTool('select')}
            >
              🖱 선택
            </button>
            <button 
              className={`tool-button ${currentTool === 'paint' ? 'active' : ''}`}
              onClick={() => setCurrentTool('paint')}
            >
              🎨 페인트
            </button>
          </div>
          
          {currentTool === 'paint' && (
            <>
              <div className="color-section">
                <h4>색상 선택</h4>
                <div className="color-palette">
                  {COLOR_PALETTE.map((colorItem, index) => (
                    <button
                      key={index}
                      className={`color-button ${selectedColor === colorItem.color ? 'active' : ''}`}
                      style={{ backgroundColor: colorItem.color }}
                      onClick={() => selectColor(colorItem.color)}
                      title={colorItem.name}
                    >
                      {selectedColor === colorItem.color && '✓'}
                    </button>
                  ))}
                </div>
                
                <div className="custom-color">
                  <label>자유 색상:</label>
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="color-picker"
                  />
                </div>
                
                <div className="brush-section">
                  <h4>브러시 크기</h4>
                  <div className="brush-size-controls">
                    <button onClick={() => setPixelSize(Math.max(1, pixelSize - 1))}>-</button>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={pixelSize}
                      onChange={(e) => setPixelSize(parseInt(e.target.value))}
                      className="size-slider"
                    />
                    <button onClick={() => setPixelSize(Math.min(10, pixelSize + 1))}>+</button>
                    <span className="size-value">{pixelSize}px</span>
                  </div>
                  
                  <div className="size-presets">
                    <button onClick={() => setPixelSize(1)}>1px</button>
                    <button onClick={() => setPixelSize(2)}>2px</button>
                    <button onClick={() => setPixelSize(3)}>3px</button>
                    <button onClick={() => setPixelSize(5)}>5px</button>
                  </div>
                </div>
                
                <div className="paint-info">
                  <p>• 좌클릭: 픽셀 칠하기</p>
                  <p>• 우클릭: 픽셀 지우기</p>
                  <p>• 브러시 크기: {pixelSize}×{pixelSize} 픽셀</p>
                </div>
              </div>
            </>
          )}
          
          <div className="info-section">
            <p>확대/축소: 마우스 휠</p>
            <p>이동: 드래그 (선택 모드)</p>
            <p>줌 레벨: {scale.toFixed(2)}x</p>
            {showDetailGrid && <p>✨ 세부 격자 모드</p>}
          </div>
        </div>
        
        <div className="canvas-container">
          <canvas
            ref={canvasRef}
            width={window.innerWidth - 300}
            height={window.innerHeight - 100}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
            onContextMenu={handleContextMenu}
            style={{ 
              cursor: currentTool === 'select' ? 'grab' : (currentTool === 'paint' ? generateCustomCursor(pixelSize, selectedColor) : 'crosshair'),
              border: '1px solid #ccc'
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default App