package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.Asistente;
import com.bidly.bidly_backend.model.ItemCatalogo;
import com.bidly.bidly_backend.model.Puja;
import com.bidly.bidly_backend.model.PujoFecha;
import com.bidly.bidly_backend.repository.AsistenteRepository;
import com.bidly.bidly_backend.repository.ItemCatalogoRepository;
import com.bidly.bidly_backend.repository.PujaRepository;
import com.bidly.bidly_backend.repository.PujoFechaRepository;
import com.bidly.bidly_backend.service.NotificacionService;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("/api/pujos")
public class PujaController {

    private static final Set<String> CATEGORIAS_SIN_LIMITE = Set.of("oro", "platino");

    @Autowired
    private PujaRepository pujaRepository;

    @Autowired
    private ItemCatalogoRepository itemCatalogoRepository;

    @Autowired
    private PujoFechaRepository pujoFechaRepository;

    @Autowired
    private AsistenteRepository asistenteRepository;

    @Autowired
    private NotificacionService notificacionService;

    @GetMapping
    public ResponseEntity<?> listar(
            @RequestParam(required = false) Long item,
            @RequestParam(required = false) Long asistente) {
        if (item != null) {
            return ResponseEntity.ok(pujaRepository.findByItemIdentificadorOrderByImporteDesc(item));
        }
        if (asistente != null) {
            return ResponseEntity.ok(pujaRepository.findByAsistenteIdentificadorOrderByImporteDesc(asistente));
        }
        return ResponseEntity.badRequest().body(Map.of("error", "Debe indicar ?item= o ?asistente=", "code", "BAD_REQUEST"));
    }

    @Transactional
    @PostMapping
    public ResponseEntity<?> pujar(@RequestBody Puja puja) {

        // 1. Body válido
        if (puja.getItem() == null || puja.getItem().getIdentificador() == null
                || puja.getAsistente() == null || puja.getAsistente().getIdentificador() == null
                || puja.getImporte() == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Campos obligatorios faltantes (item, asistente, importe)", "code", "BAD_BODY"));
        }

        // 2. Asistente existe
        Optional<Asistente> asistenteOpt = asistenteRepository.findById(puja.getAsistente().getIdentificador());
        if (asistenteOpt.isEmpty()) {
            return ResponseEntity.status(404)
                    .body(Map.of("error", "Asistente no encontrado", "code", "NOT_FOUND"));
        }
        Asistente asistente = asistenteOpt.get();

        // 3. Ítem existe — con lock pesimista para serializar pujas concurrentes
        Optional<ItemCatalogo> itemOpt = itemCatalogoRepository.findByIdForUpdate(puja.getItem().getIdentificador());
        if (itemOpt.isEmpty()) {
            return ResponseEntity.status(404)
                    .body(Map.of("error", "Item no encontrado", "code", "NOT_FOUND"));
        }
        ItemCatalogo item = itemOpt.get();

        // 4. Asistente pertenece a la subasta del ítem
        Long subastaDelItem = item.getCatalogo().getSubasta().getIdentificador();
        if (!subastaDelItem.equals(asistente.getSubasta().getIdentificador())) {
            return ResponseEntity.status(403)
                    .body(Map.of("error", "El asistente no pertenece a esta subasta", "code", "FORBIDDEN"));
        }

        // 5–8. Sin pasarela real: no bloqueamos por categoría ni medio de pago.
        String categoriaSubasta = item.getCatalogo().getSubasta().getCategoria();
        Long clienteId = asistente.getCliente().getIdentificador();

        if (!"abierta".equals(item.getCatalogo().getSubasta().getEstado())) {
            return ResponseEntity.status(409)
                    .body(Map.of("error", "La subasta no está abierta", "code", "AUCTION_CLOSED"));
        }

        if ("si".equals(item.getSubastado())) {
            return ResponseEntity.status(409)
                    .body(Map.of("error", "El item ya fue adjudicado", "code", "ITEM_SOLD"));
        }

        // 9. Mínimo: última puja + 1% del precio base (o precio base si no hay pujas)
        BigDecimal precioBase = item.getPrecioBase();
        BigDecimal minIncremento = precioBase.multiply(BigDecimal.valueOf(0.01))
                .setScale(2, RoundingMode.HALF_UP);
        Optional<Puja> ultimaPujaOpt = pujaRepository.findTopByItemIdentificadorOrderByImporteDesc(
                item.getIdentificador());
        BigDecimal minimoAceptable = ultimaPujaOpt
                .map(p -> p.getImporte().add(minIncremento))
                .orElse(precioBase);

        if (puja.getImporte().compareTo(minimoAceptable) < 0) {
            return ResponseEntity.status(400).body(Map.of(
                    "error", "Importe menor al mínimo aceptable",
                    "code", "MIN_BID",
                    "minimoAceptable", minimoAceptable));
        }

        // 10. Máximo: última puja + 20% del precio base (excepto subastas oro/platino)
        if (!CATEGORIAS_SIN_LIMITE.contains(categoriaSubasta)) {
            BigDecimal maximoAceptable = ultimaPujaOpt.isPresent()
                    ? ultimaPujaOpt.get().getImporte()
                            .add(precioBase.multiply(BigDecimal.valueOf(0.20)))
                            .setScale(2, RoundingMode.HALF_UP)
                    : precioBase.multiply(BigDecimal.valueOf(1.20))
                            .setScale(2, RoundingMode.HALF_UP);

            if (puja.getImporte().compareTo(maximoAceptable) > 0) {
                return ResponseEntity.status(400).body(Map.of(
                        "error", "El importe supera el máximo permitido",
                        "code", "MAX_BID",
                        "maximoAceptable", maximoAceptable));
            }
        }

        // 11. Guardar puja
        puja.setGanador("no");
        Puja guardada = pujaRepository.save(puja);
        LocalDateTime ahora = LocalDateTime.now();
        PujoFecha pf = new PujoFecha();
        pf.setPujo(guardada.getIdentificador());
        pf.setFechaHora(ahora);
        pujoFechaRepository.save(pf);
        guardada.setFechaHora(ahora);

        String producto = item.getProducto().getDescripcionCatalogo();
        notificacionService.crear(clienteId, "lider",
                "Tu puja de $" + puja.getImporte() + " lidera en " + producto);
        ultimaPujaOpt.ifPresent(anterior -> {
            Long anteriorClienteId = anterior.getAsistente().getCliente().getIdentificador();
            if (!anteriorClienteId.equals(clienteId)) {
                notificacionService.crear(anteriorClienteId, "perdiste",
                        "Superaron tu puja en " + producto);
            }
        });

        return ResponseEntity.status(201).body(guardada);
    }

    @GetMapping("/{itemId}/ganador")
    public ResponseEntity<?> ganador(@PathVariable Long itemId) {
        if (!itemCatalogoRepository.existsById(itemId)) {
            return ResponseEntity.status(404).body(Map.of("error", "Item no encontrado", "code", "NOT_FOUND"));
        }
        return pujaRepository.findByItemIdentificadorAndGanador(itemId, "si")
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(404).body(null));
    }
}
