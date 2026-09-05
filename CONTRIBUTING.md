# Guia de Contribucion y Flujo de Trabajo Escalable (GitFlow Multiagente)

Para garantizar la estabilidad del nodo principal (main) y permitir el trabajo simultaneo de agentes de IA y desarrolladores sin generar conflictos ni regresiones, el proyecto implementa un modelo de branching modular y escalable.

---

## Arquitectura de Ramas (Espacios de Trabajo)

`
        (v1.0.0-release)
main ----------------------------------------*----------------- (Produccion Protegida)
       \                                    /
develop --------*-----------------*--------*------------------- (Integracion Continua)
          \     /                 /        /
feature/   *---* (frontend)       /        /
feature/         *---------------* (core) /
feature/                     *-----------* (firmware / dualwrite)
`

### 1. Rama Principal (main) - Nodo Protegido
* Propósito: Codigo estable de produccion, 100% probado, validado y versionado mediante tags semanticos.
* Regla: Nunca se realiza push directo a main. Todo cambio debe originarse en una rama feature/* o develop y aprobarse mediante un Pull Request que supere la suite de CI automatizada.

### 2. Rama de Integracion (develop)
* Propósito: Espacio comun donde se combinan las funcionalidades desarrolladas por los distintos agentes antes de preparar una nueva version de produccion.

### 3. Ramas Modulares de Caracteristica (feature/*)
Cada area de responsabilidad tecnica cuenta con su propio espacio aislado:

| Rama | Responsabilidad Tecnica | Alcance |
| :--- | :--- | :--- |
| feature/frontend-kiosk | Interfaz React, TypeScript, Tailwind y Electron | Vistas tactiles, ergonomia, WindowBar y empaquetado de kiosco. |
| feature/backend-core | Motor transaccional FastAPI y WebSockets | Logica bancaria, retiros arbitrarios, endpoints REST y seguridad TOTP. |
| feature/firmware-hardware | Firmware embebido Arduino Mega y ESP32-CAM | Control de motores paso a paso A4988, sensores opticos IR y sonar. |
| feature/storage-dualwrite | Persistencia dual concurrente | Modelos MySQL InnoDB, SQLite fallback y archivos planos .txt. |
| feature/multiagent-graphify | Inteligencia multiagente y AST Graphify | Grafo de dependencias determinista Tree-sitter y optimizacion de contexto. |

---

## Protocolo de Actualizacion Escalable

Para realizar modificaciones sin riesgo de afectar el nodo principal:

1. Crear una rama desde develop:
   git checkout develop
   git pull origin develop
   git checkout -b feature/nombre-de-tu-mejora

2. Realizar cambios y validar localmente:
   pytest backend/tests/ -v
   cd frontend && npm run build

3. Subir los cambios a tu rama remota:
   git add .
   git commit -m feat: descripcion del cambio
   git push origin feature/nombre-de-tu-mejora

4. Abrir Pull Request hacia develop:
   La GitHub Action ci.yml ejecutara automaticamente las pruebas y compilaciones.
   Al verificarse todos los checks en verde, se realiza el merge sin comprometer main.

5. Lanzamiento a Produccion (main):
   Cuando develop alcanza un hito estable, se realiza un PR hacia main y se genera una nueva etiqueta semantica (ej. v1.1.0).