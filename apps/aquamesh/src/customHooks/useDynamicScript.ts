import React from "react"

const useDynamicScript = ({ url }: { url: string }) => {
  const [ready, setReady] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    if (!url) {
      return
    }

    const element = document.createElement("script")

    element.src = url
    element.type = "text/javascript"
    element.async = true

    setReady(false)
    setFailed(false)

    element.onload = () => {
      setReady(true)
    }

    element.onerror = () => {
      console.error(`Dynamic Script Error: ${url}`)
      setReady(false)
      setFailed(true)
    }

    document.head.appendChild(element)

    return () => {
      document.head.removeChild(element)
    }
  }, [url])

  return { ready, failed }
}

export default useDynamicScript
