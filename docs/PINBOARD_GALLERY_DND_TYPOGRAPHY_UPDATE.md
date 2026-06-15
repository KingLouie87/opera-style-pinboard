# Pinboard gallery cards, collapsed drop zones and typography pass

Diese Version fokussiert sich auf drei Punkte:

1. Pins wurden stärker in Richtung hochwertiger visueller Content-Cards überarbeitet. Coverbilder dominieren, der Glas-/Gradientbereich sitzt bündig über der Bildfläche und bleibt ohne störenden Innenrahmen.
2. Minimierte Teilbereiche bleiben als Droppable-Zonen registriert. Die Collision-Detection priorisiert Teilbereiche und Sidebar-Ziele, sodass Pins auch bei geschlossenen Bereichen abgelegt werden können.
3. Das Typografie-System nutzt Aptos mit hochwertigen Fallbacks und begrenzt die UI auf wenige Schriftgrößen.

Wichtig: Für diese Änderung ist keine neue Supabase-Migration erforderlich.
