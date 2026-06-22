package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.Asistente;
import com.bidly.bidly_backend.model.ItemCatalogo;
import com.bidly.bidly_backend.model.Puja;
import com.bidly.bidly_backend.model.PujoFecha;
import com.bidly.bidly_backend.model.Subasta;
import com.bidly.bidly_backend.repository.AsistenteRepository;
import com.bidly.bidly_backend.repository.ItemCatalogoRepository;
import com.bidly.bidly_backend.repository.PujaRepository;
import com.bidly.bidly_backend.repository.PujoFechaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/pujos")
public class PujaController {

    @Autowired
    private PujaRepository pujaRepository;

    @Autowired
    private ItemCatalogoRepository itemCatalogoRepository;

    @Autowired
    private PujoFechaRepository pujoFechaRepository;

    @Autowired
    private AsistenteRepository asistenteRepository;

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
        return ResponseEntity.badRequest().body(Map.of("error", "Debe indicar ?item= o ?asistente="));
    }

    @PostMapping
    public ResponseEntity<?> pujar(@RequestBody Puja puja) {
        if (puja.getItem() == null || puja.getItem().getIdentificador() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "El campo 'item' es obligatorio"));
        }
        if (puja.getImporte() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "El campo 'importe' es obligatorio"));
        }

        Optional<ItemCatalogo> itemOpt = itemCatalogoRepository.findById(puja.getItem().getIdentificador());
        if (itemOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        ItemCatalogo item = itemOpt.get();

        // Preciobase válido
        BigDecimal precioBase = item.getPrecioBase();
        if (precioBase == null || precioBase.compareTo(BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "El ítem no tiene precio base válido"));
        }

        // Bloqueo propia subasta
        Subasta subasta = item.getCatalogo() != null ? item.getCatalogo().getSubasta() : null;
        if (puja.getAsistente() != null && puja.getAsistente().getIdentificador() != null && subasta != null) {
            Asistente asistente = asistenteRepository.findById(puja.getAsistente().getIdentificador()).orElse(null);
            if (asistente != null && asistente.getCliente() != null
                    && asistente.getCliente().getIdentificador().equals(subasta.getSubastador())) {
                return ResponseEntity.status(403).body(Map.of("error", "No podés pujar en tu propia subasta"));
            }
        }

        Optional<Puja> ultimaPuja = pujaRepository.findTopByItemIdentificadorOrderByImporteDesc(item.getIdentificador());

        // R3: subastas oro/platino quedan exentas de R1 y R2
        String categoriaSubasta = subasta != null ? subasta.getCategoria() : null;
        boolean esExento = "oro".equals(categoriaSubasta) || "platino".equals(categoriaSubasta);

        if (esExento) {
            // Solo exigir que supere la oferta anterior (o iguale el precio base en la primera puja)
            boolean invalido = ultimaPuja.isPresent()
                    ? puja.getImporte().compareTo(ultimaPuja.get().getImporte()) <= 0
                    : puja.getImporte().compareTo(precioBase) < 0;
            if (invalido) {
                BigDecimal minExento = ultimaPuja
                        .map(p -> p.getImporte().add(BigDecimal.valueOf(0.01)))
                        .orElse(precioBase);
                return ResponseEntity.unprocessableEntity().body(Map.of(
                        "error", "El importe debe superar la oferta actual",
                        "minimoAceptable", minExento
                ));
            }
        } else {
            // R1 — mínimo: última oferta + 1% del precio base
            BigDecimal minIncremento = precioBase.multiply(BigDecimal.valueOf(0.01))
                    .setScale(2, RoundingMode.HALF_UP);
            BigDecimal minimoAceptable = ultimaPuja
                    .map(p -> p.getImporte().add(minIncremento))
                    .orElse(precioBase);

            if (puja.getImporte().compareTo(minimoAceptable) < 0) {
                return ResponseEntity.unprocessableEntity().body(Map.of(
                        "error", "Importe menor al mínimo aceptable: " + minimoAceptable,
                        "minimoAceptable", minimoAceptable
                ));
            }

            // R2 — máximo: última oferta + 20% del precio base (solo cuando ya hay pujas)
            if (ultimaPuja.isPresent()) {
                BigDecimal maxIncremento = precioBase.multiply(BigDecimal.valueOf(0.20))
                        .setScale(2, RoundingMode.HALF_UP);
                BigDecimal maximoAceptable = ultimaPuja.get().getImporte().add(maxIncremento);
                if (puja.getImporte().compareTo(maximoAceptable) > 0) {
                    return ResponseEntity.unprocessableEntity().body(Map.of(
                            "error", "Importe mayor al máximo aceptable: " + maximoAceptable,
                            "maximoAceptable", maximoAceptable
                    ));
                }
            }
        }

        puja.setGanador("no");
        Puja guardada = pujaRepository.save(puja);
        LocalDateTime ahora = LocalDateTime.now();
        PujoFecha pf = new PujoFecha();
        pf.setPujo(guardada.getIdentificador());
        pf.setFechaHora(ahora);
        pujoFechaRepository.save(pf);
        guardada.setFechaHora(ahora);
        return ResponseEntity.status(201).body(guardada);
    }

    @GetMapping("/{itemId}/ganador")
    public ResponseEntity<?> ganador(@PathVariable Long itemId) {
        if (!itemCatalogoRepository.existsById(itemId)) {
            return ResponseEntity.notFound().build();
        }
        return pujaRepository.findByItemIdentificadorAndGanador(itemId, "si")
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.status(404).body(null));
    }
}
