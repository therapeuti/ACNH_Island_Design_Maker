import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'

function App() {
  // 단계 관리
  const [currentStep, setCurrentStep] = useState('canvas') // 'imageAdjust' 또는 'canvas'
  
  // 캔버스 관련 상태
  const [currentTool, setCurrentTool] = useState('select')
  const [pixelGrid, setPixelGrid] = useState({}) // 픽셀별 색상 저장
  const [placedItems, setPlacedItems] = useState([]) // 배치된 아이템들
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [showDetailGrid, setShowDetailGrid] = useState(false)
  
  // 색상 설정
  const [selectedColor, setSelectedColor] = useState('#417B41')
  const [pixelSize, setPixelSize] = useState(1) // 픽셀 브러시 크기
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 })
  const [showCustomCursor, setShowCustomCursor] = useState(false)
  
  // 아이템 배치 관련 상태
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('buildings')
  const [draggingItem, setDraggingItem] = useState(null)
  const [loadedImages, setLoadedImages] = useState({})
  
  // 임시 도구 상태 (스페이스바)
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const [tempTool, setTempTool] = useState(null)
  
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
  
  // 아이템 카테고리 정의
  const ITEM_CATEGORIES = {
    buildings: {
      name: '건물',
      items: [
        { id: 'house', name: '주민 집', image: 'building-house.png', size: { width: 40, height: 40 } },
        { id: 'playerhouse', name: '플레이어 집', image: 'building-playerhouse.png', size: { width: 40, height: 40 } },
        { id: 'townhall', name: '안내소', image: 'building-townhall.png', size: { width: 60, height: 60 } },
        { id: 'nook', name: '너굴 상점', image: 'building-nook.png', size: { width: 50, height: 40 } },
        { id: 'museum', name: '박물관', image: 'building-museum.png', size: { width: 60, height: 40 } },
        { id: 'able', name: '에이블 시스터즈', image: 'building-able.png', size: { width: 50, height: 40 } },
        { id: 'campsite', name: '캠핑장', image: 'building-campsite.png', size: { width: 40, height: 40 } },
        { id: 'tent', name: '텐트', image: 'building-tent.png', size: { width: 30, height: 30 } }
      ]
    },
    trees: {
      name: '나무',
      items: [
        { id: 'tree', name: '일반 나무', image: 'tree/tree.png', size: { width: 20, height: 30 } },
        { id: 'fruit', name: '과일나무', image: 'tree-fruit.png', size: { width: 20, height: 30 } },
        { id: 'palm', name: '야자나무', image: 'tree/palm.png', size: { width: 15, height: 25 } },
        { id: 'pine', name: '소나무', image: 'tree/pine.png', size: { width: 18, height: 28 } },
        { id: 'bamboo', name: '대나무', image: 'tree-bamboo.png', size: { width: 12, height: 25 } },
        { id: 'sakura', name: '벚나무', image: 'tree/tree-sakura.png', size: { width: 20, height: 30 } }
      ]
    },
    structures: {
      name: '구조물',
      items: [
        { id: 'bridge-h', name: '다리(가로)', image: 'structure-bridge-horizontal.png', size: { width: 60, height: 20 } },
        { id: 'bridge-v', name: '다리(세로)', image: 'structure-bridge-vertical.png', size: { width: 20, height: 60 } },
        { id: 'lighthouse', name: '등대', image: 'structure-lighthouse.png', size: { width: 25, height: 40 } },
        { id: 'ramp', name: '경사로', image: 'structure-ramp.png', size: { width: 30, height: 30 } },
        { id: 'airport', name: '공항', image: 'structure/airport.png', size: { width: 80, height: 80 } }
      ]
    },
    flowers: {
      name: '꽃',
      items: [
        { id: 'redtulips', name: '빨간 튤립', image: 'flower/redtulips.png', size: { width: 8, height: 8 } },
        { id: 'yellowtulips', name: '노란 튤립', image: 'flower/yellowtulips.png', size: { width: 8, height: 8 } },
        { id: 'whitetulips', name: '흰 튤립', image: 'flower/whitetulips.png', size: { width: 8, height: 8 } },
        { id: 'redroses', name: '빨간 장미', image: 'flower/redroses.png', size: { width: 8, height: 8 } },
        { id: 'yellowroses', name: '노란 장미', image: 'flower/yellowroses.png', size: { width: 8, height: 8 } },
        { id: 'whiteroses', name: '흰 장미', image: 'flower/whiteroses.png', size: { width: 8, height: 8 } }
      ]
    }
  }
  
  // 색상 팔레트 (색상정의.txt 기반)
  const COLOR_PALETTE = [
    { name: '배경색', color: '#7AD8C6' },
    { name: '강물', color: '#7CD8C3' }, 
    { name: '암석', color: '#6E7884' },
    { name: '모래', color: '#EEE6A5' },
    { name: '섬', color: '#417B41' },
    { name: '1층 절벽', color: '#3D9B3A' },
    { name: '2층 절벽', color: '#5CC648' },
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
  
  // 이미지 프리로딩
  useEffect(() => {
    const preloadImages = () => {
      const imagesToLoad = []
      
      Object.values(ITEM_CATEGORIES).forEach(category => {
        category.items.forEach(item => {
          imagesToLoad.push(item.image)
        })
      })
      
      imagesToLoad.forEach(imagePath => {
        if (!loadedImages[imagePath]) {
          const img = new Image()
          img.onload = () => {
            setLoadedImages(prev => ({ ...prev, [imagePath]: img }))
          }
          img.src = `./item/${imagePath}`
        }
      })
    }
    
    preloadImages()
  }, [])
  
  // Canvas 그리기 함수들
  const drawGrid = useCallback((ctx) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const gridWidth = 7 * CELL_SIZE
    const gridHeight = 6 * CELL_SIZE
    
    // 캔버스 중앙에 격자 배치를 위한 오프셋 계산
    const centerOffsetX = (canvas.width - gridWidth * scale) / 2
    const centerOffsetY = (canvas.height - gridHeight * scale) / 2
    
    ctx.save()
    ctx.scale(scale, scale)
    ctx.translate((offset.x + centerOffsetX) / scale, (offset.y + centerOffsetY) / scale)
    
    // 배경
    ctx.fillStyle = croppedBackground ? 'rgba(122, 216, 198, 0.2)' : '#7AD8C6'
    ctx.fillRect(0, 0, gridWidth, gridHeight)
    
    // 세부 격자 (먼저 그리기)
    if (showDetailGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.lineWidth = 0.3
      
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
    }
    
    // 기본 격자
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.lineWidth = 1
    
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
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, gridWidth, gridHeight)
    
    ctx.restore()
  }, [scale, offset, showDetailGrid, croppedBackground])
  
  const drawBackgroundImage = useCallback((ctx) => {
    if (!croppedBackground) return
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const gridWidth = 7 * CELL_SIZE
    const gridHeight = 6 * CELL_SIZE
    
    // 캔버스 중앙에 격자 배치를 위한 오프셋 계산
    const centerOffsetX = (canvas.width - gridWidth * scale) / 2
    const centerOffsetY = (canvas.height - gridHeight * scale) / 2
    
    ctx.save()
    ctx.scale(scale, scale)
    ctx.translate((offset.x + centerOffsetX) / scale, (offset.y + centerOffsetY) / scale)
    
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
    ctx.globalAlpha = 0.9
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
    const canvas = canvasRef.current
    if (!canvas) return
    
    const gridWidth = 7 * CELL_SIZE
    const gridHeight = 6 * CELL_SIZE
    
    // 캔버스 중앙에 격자 배치를 위한 오프셋 계산
    const centerOffsetX = (canvas.width - gridWidth * scale) / 2
    const centerOffsetY = (canvas.height - gridHeight * scale) / 2
    
    ctx.save()
    ctx.scale(scale, scale)
    ctx.translate((offset.x + centerOffsetX) / scale, (offset.y + centerOffsetY) / scale)
    
    const pixelSize = CELL_SIZE / DETAIL_GRID_SIZE // 5px per pixel
    
    Object.entries(pixelGrid).forEach(([key, color]) => {
      const [x, y] = key.split(',').map(Number)
      ctx.fillStyle = color
      ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize)
    })
    
    ctx.restore()
  }, [pixelGrid, scale, offset])
  
  // 배치된 아이템들 그리기
  const drawPlacedItems = useCallback((ctx) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const gridWidth = 7 * CELL_SIZE
    const gridHeight = 6 * CELL_SIZE
    
    // 캔버스 중앙에 격자 배치를 위한 오프셋 계산
    const centerOffsetX = (canvas.width - gridWidth * scale) / 2
    const centerOffsetY = (canvas.height - gridHeight * scale) / 2
    
    ctx.save()
    ctx.scale(scale, scale)
    ctx.translate((offset.x + centerOffsetX) / scale, (offset.y + centerOffsetY) / scale)
    
    placedItems.forEach(item => {
      const img = loadedImages[item.image]
      
      if (img && img.complete) {
        ctx.globalAlpha = item.placedId === draggingItem?.placedId ? 0.7 : 1
        ctx.drawImage(
          img, 
          item.x - item.size.width / 2, 
          item.y - item.size.height / 2, 
          item.size.width, 
          item.size.height
        )
        
        // 선택된 아이템에 테두리 표시
        if (selectedItem && selectedItem.placedId === item.placedId) {
          ctx.strokeStyle = '#e74c3c'
          ctx.lineWidth = 2
          ctx.strokeRect(
            item.x - item.size.width / 2 - 2, 
            item.y - item.size.height / 2 - 2, 
            item.size.width + 4, 
            item.size.height + 4
          )
        }
      }
    })
    
    ctx.globalAlpha = 1
    ctx.restore()
  }, [placedItems, scale, offset, selectedItem, draggingItem, loadedImages])
  
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    drawBackgroundImage(ctx)
    drawGrid(ctx)
    drawPixelGrid(ctx)
    drawPlacedItems(ctx)
  }, [drawGrid, drawBackgroundImage, drawPixelGrid, drawPlacedItems])
  
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
  
  // 캔버스 모드에서 키보드 조작
  useEffect(() => {
    if (currentStep !== 'canvas') return

    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          if (selectedItem && selectedItem.placedId) {
            e.preventDefault()
            deleteSelectedItem()
          }
          break
        case 'Escape':
          setSelectedItem(null)
          setCurrentTool('select')
          break
        case ' ':
          if (!isSpacePressed && (currentTool === 'paint' || currentTool === 'place')) {
            e.preventDefault()
            setIsSpacePressed(true)
            setTempTool(currentTool)
          }
          break
      }
    }

    const handleKeyUp = (e) => {
      switch (e.key) {
        case ' ':
          if (isSpacePressed) {
            e.preventDefault()
            setIsSpacePressed(false)
            setTempTool(null)
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
    }
  }, [currentStep, selectedItem, isSpacePressed, currentTool])
  
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
    
    const gridWidth = 7 * CELL_SIZE
    const gridHeight = 6 * CELL_SIZE
    
    // 캔버스 중앙에 격자 배치를 위한 오프셋 계산
    const centerOffsetX = (canvas.width - gridWidth * scale) / 2
    const centerOffsetY = (canvas.height - gridHeight * scale) / 2
    
    return {
      x: (e.clientX - rect.left - offset.x - centerOffsetX) / scale,
      y: (e.clientY - rect.top - offset.y - centerOffsetY) / scale
    }
  }
  
  const handleMouseDown = (e) => {
    const pos = getCanvasPos(e)
    const effectiveTool = isSpacePressed ? 'select' : currentTool
    
    if (effectiveTool === 'select') {
      // 배치된 아이템 클릭 체크
      const clickedItem = placedItems.find(item => {
        return pos.x >= item.x - item.size.width / 2 &&
               pos.x <= item.x + item.size.width / 2 &&
               pos.y >= item.y - item.size.height / 2 &&
               pos.y <= item.y + item.size.height / 2
      })
      
      if (clickedItem && !isSpacePressed) {
        setSelectedItem({ ...clickedItem, placedId: clickedItem.placedId })
        setDraggingItem(clickedItem)
        lastPos.current = { x: e.clientX, y: e.clientY }
      } else {
        if (!isSpacePressed) setSelectedItem(null)
        isDragging.current = true
        lastPos.current = { x: e.clientX, y: e.clientY }
      }
    } else if (effectiveTool === 'place' && selectedItem) {
      // 아이템 배치
      placeItem(pos.x, pos.y)
    } else if (effectiveTool === 'paint') {
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
    const effectiveTool = isSpacePressed ? 'select' : currentTool
    
    if (draggingItem && !isSpacePressed) {
      // 아이템 드래그 (스페이스바 누른 상태에서는 비활성화)
      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      
      setPlacedItems(prev => prev.map(item => 
        item.placedId === draggingItem.placedId 
          ? { ...item, x: item.x + dx / scale, y: item.y + dy / scale }
          : item
      ))
      
      lastPos.current = { x: e.clientX, y: e.clientY }
    } else if (isDragging.current && effectiveTool === 'select') {
      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
      lastPos.current = { x: e.clientX, y: e.clientY }
    }
    
    // 페인트 모드에서 커서 위치 추적
    if (effectiveTool === 'paint' && !isSpacePressed) {
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
    if (draggingItem) {
      setDraggingItem(null)
    }
  }
  
  const handleWheel = (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    const scaleBy = 1.1
    const newScale = e.deltaY < 0 ? scale * scaleBy : scale / scaleBy
    const clampedScale = Math.max(1, Math.min(5, newScale))
    
    // 마우스 커서를 기준으로 확대/축소하기 위한 오프셋 조정
    if (clampedScale !== scale) {
      const gridWidth = 7 * CELL_SIZE
      const gridHeight = 6 * CELL_SIZE
      const centerOffsetX = (canvas.width - gridWidth * scale) / 2
      const centerOffsetY = (canvas.height - gridHeight * scale) / 2
      
      // 마우스 위치를 격자 좌표계로 변환
      const mouseGridX = (mouseX - offset.x - centerOffsetX) / scale
      const mouseGridY = (mouseY - offset.y - centerOffsetY) / scale
      
      // 새로운 스케일에서의 중앙 오프셋
      const newCenterOffsetX = (canvas.width - gridWidth * clampedScale) / 2
      const newCenterOffsetY = (canvas.height - gridHeight * clampedScale) / 2
      
      // 마우스 위치가 같은 격자 위치를 가리키도록 오프셋 조정
      const newOffset = {
        x: mouseX - mouseGridX * clampedScale - newCenterOffsetX,
        y: mouseY - mouseGridY * clampedScale - newCenterOffsetY
      }
      
      setOffset(newOffset)
    }
    
    setScale(clampedScale)
    setShowDetailGrid(clampedScale >= DETAIL_SCALE_THRESHOLD)
  }

  // 이미지 조정 기능들
  const handleImageScaleInput = (value) => {
    const newScale = parseFloat(value)
    if (!isNaN(newScale) && newScale > 0) {
      const clampedScale = Math.max(0.1, Math.min(10, newScale))
      
      // 이미지 중앙을 기준으로 확대/축소하기 위한 위치 조정
      if (originalImage) {
        const scaleDiff = clampedScale - imageScale
        const imageCenterX = originalImage.width / 2
        const imageCenterY = originalImage.height / 2
        
        setImagePosition(current => ({
          x: current.x - imageCenterX * scaleDiff,
          y: current.y - imageCenterY * scaleDiff
        }))
      }
      
      setImageScale(clampedScale)
    }
  }

  const adjustImageScale = (delta) => {
    setImageScale(prev => {
      const newScale = Math.max(0.1, Math.min(10, prev + delta))
      
      // 이미지 중앙을 기준으로 확대/축소하기 위한 위치 조정
      if (originalImage) {
        const scaleDiff = newScale - prev
        const imageCenterX = originalImage.width / 2
        const imageCenterY = originalImage.height / 2
        
        setImagePosition(current => ({
          x: current.x - imageCenterX * scaleDiff,
          y: current.y - imageCenterY * scaleDiff
        }))
      }
      
      return newScale
    })
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
  
  // 아이템 배치 함수
  const placeItem = (x, y) => {
    if (!selectedItem) return
    
    const gridWidth = 7 * CELL_SIZE
    const gridHeight = 6 * CELL_SIZE
    
    // 격자 범위 내에서만 배치
    if (x >= 0 && x <= gridWidth && y >= 0 && y <= gridHeight) {
      const newItem = {
        ...selectedItem,
        x: x,
        y: y,
        placedId: Date.now() + Math.random() // 고유 ID
      }
      
      setPlacedItems(prev => [...prev, newItem])
    }
  }
  
  // 아이템 삭제
  const deleteSelectedItem = () => {
    if (selectedItem && selectedItem.placedId) {
      setPlacedItems(prev => prev.filter(item => item.placedId !== selectedItem.placedId))
      setSelectedItem(null)
    }
  }
  
  // 아이템 선택
  const selectItemFromPalette = (item) => {
    setSelectedItem(item)
    setCurrentTool('place')
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
          // 이미지를 격자 중앙에 배치 (1280x720 해상도 기준으로 최적화)
          const gridWidth = 7 * CELL_SIZE
          const gridHeight = 6 * CELL_SIZE
          
          // 1280x720 이미지에 맞는 최적 스케일 계산
          const scaleX = gridWidth / img.width
          const scaleY = gridHeight / img.height
          const optimalScale = Math.min(scaleX, scaleY, 1) // 최대 100%까지만
          
          setImagePosition({ 
            x: (gridWidth - img.width * optimalScale) / 2, 
            y: (gridHeight - img.height * optimalScale) / 2 
          })
          setImageScale(optimalScale)
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
      version: '1.1',
      timestamp: new Date().toISOString(),
      croppedBackground: croppedBackground ? croppedBackground.toDataURL() : null,
      pixelGrid,
      placedItems,
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
          setPlacedItems(projectData.placedItems || [])
          setScale(projectData.scale || 1)
          setOffset(projectData.offset || { x: 0, y: 0 })
          
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
                <button onClick={() => handleImageScaleInput('0.5')}>50%</button>
                <button onClick={() => handleImageScaleInput('1.0')}>100%</button>
                <button onClick={() => handleImageScaleInput('1.5')}>150%</button>
                <button onClick={() => handleImageScaleInput('2.0')}>200%</button>
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
              onClick={() => { setCurrentTool('select'); setSelectedItem(null); }}
            >
              🖱 선택
            </button>
            <button 
              className={`tool-button ${currentTool === 'paint' ? 'active' : ''}`}
              onClick={() => { setCurrentTool('paint'); setSelectedItem(null); }}
            >
              🎨 페인트
            </button>
            <button 
              className={`tool-button ${currentTool === 'place' ? 'active' : ''}`}
              onClick={() => setCurrentTool('place')}
            >
              🏠 아이템
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
                  <p>• 스페이스바: 임시 선택 모드</p>
                </div>
              </div>
            </>
          )}
          
          {currentTool === 'place' && (
            <>
              <div className="item-section">
                <h4>아이템 카테고리</h4>
                <div className="category-buttons">
                  {Object.entries(ITEM_CATEGORIES).map(([key, category]) => (
                    <button
                      key={key}
                      className={`category-button ${selectedCategory === key ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(key)}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
                
                <h4>아이템 목록</h4>
                <div className="item-palette">
                  {ITEM_CATEGORIES[selectedCategory].items.map(item => (
                    <button
                      key={item.id}
                      className={`item-button ${selectedItem?.id === item.id ? 'active' : ''}`}
                      onClick={() => selectItemFromPalette(item)}
                      title={item.name}
                    >
                      <img 
                        src={`./item/${item.image}`} 
                        alt={item.name}
                        style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                      />
                      <span className="item-name">{item.name}</span>
                    </button>
                  ))}
                </div>
                
                {selectedItem && (
                  <div className="selected-item-info">
                    <h4>선택된 아이템</h4>
                    <p>{selectedItem.name}</p>
                    <p>크기: {selectedItem.size.width}×{selectedItem.size.height}</p>
                    {selectedItem.placedId && (
                      <button 
                        onClick={deleteSelectedItem}
                        className="delete-button"
                      >
                        🗑 삭제 (Del키)
                      </button>
                    )}
                  </div>
                )}
                
                <div className="place-info">
                  <p>• 클릭: 아이템 배치</p>
                  <p>• 드래그: 아이템 이동</p>
                  <p>• Del키: 선택된 아이템 삭제</p>
                  <p>• Esc키: 선택 해제</p>
                  <p>• 스페이스바: 임시 선택 모드</p>
                </div>
              </div>
            </>
          )}
          
          <div className="info-section">
            <p>확대/축소: 마우스 휠</p>
            <p>이동: 드래그 (선택 모드)</p>
            <p>스페이스바: 임시 선택/이동 모드</p>
            <p>줌 레벨: {scale.toFixed(2)}x</p>
            {showDetailGrid && <p>✨ 세부 격자 모드</p>}
            {placedItems.length > 0 && <p>배치된 아이템: {placedItems.length}개</p>}
            {isSpacePressed && <p style={{color: '#e74c3c'}}>🔄 임시 선택 모드</p>}
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
              cursor: isSpacePressed ? 'grab' :
                      currentTool === 'select' ? 'grab' : 
                      currentTool === 'paint' ? generateCustomCursor(pixelSize, selectedColor) : 
                      currentTool === 'place' && selectedItem ? 'copy' : 'crosshair',
              border: '1px solid #ccc'
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default App