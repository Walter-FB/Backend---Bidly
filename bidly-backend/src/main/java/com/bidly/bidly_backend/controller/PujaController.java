package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.ItemCatalogo;
import com.bidly.bidly_backend.model.Puja;
import com.bidly.bidly_backend.repository.ItemCatalogoRepository;
import com.bidly.bidly_backend.repository.PujaRepository;
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

        Optional<ItemCatalogo> itemOpt = itemCatalogoRepository.findById(puja.getItem().getIdentificador());
        if (itemOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        ItemCatalogo item = itemOpt.get();
        BigDecimal precioBase = item.getPrecioBase();
        BigDecimal minIncremento = precioBase.multiply(BigDecimal.valueOf(0.01))
                .setScale(2, RoundingMode.HALF_UP);

        Optional<Puja> ultimaPuja = pujaRepository.findTopByItemIdentificadorOrderByImporteDesc(
                item.getIdentificador());

        BigDecimal minimoAceptable = ultimaPuja
                .map(p -> p.getImporte().add(minIncremento))
                .orElse(precioBase);

        if (puja.getImporte() == null || puja.getImporte().compareTo(minimoAceptable) < 0) {
            return ResponseEntity.unprocessableEntity().body(Map.of(
                    "error", "Importe inválido. El mínimo aceptable es " + minimoAceptable,
                    "minimoAceptable", minimoAceptable
            ));
        }

        puja.setGanador("no");
        puja.setFechaHora(LocalDateTime.now());
        Puja guardada = pujaRepository.save(puja);
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
