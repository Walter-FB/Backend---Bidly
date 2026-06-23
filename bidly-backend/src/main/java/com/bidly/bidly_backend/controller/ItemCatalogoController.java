package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.Catalogo;
import com.bidly.bidly_backend.model.ItemCatalogo;
import com.bidly.bidly_backend.model.Producto;
import com.bidly.bidly_backend.repository.CatalogoRepository;
import com.bidly.bidly_backend.repository.ItemCatalogoRepository;
import com.bidly.bidly_backend.repository.ProductoRepository;
import com.bidly.bidly_backend.service.ItemAdjudicacionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
public class ItemCatalogoController {

    private static final BigDecimal COMISION_BIDLY = new BigDecimal("0.10");

    @Autowired
    private ItemCatalogoRepository itemCatalogoRepository;

    @Autowired
    private CatalogoRepository catalogoRepository;

    @Autowired
    private ProductoRepository productoRepository;

    @Autowired
    private ItemAdjudicacionService itemAdjudicacionService;

    @PostMapping("/api/catalogos/{catalogoId}/items")
    public ResponseEntity<?> agregarItem(@PathVariable Long catalogoId,
                                          @RequestBody Map<String, Object> body) {
        Catalogo catalogo = catalogoRepository.findById(catalogoId).orElse(null);
        if (catalogo == null) return ResponseEntity.notFound().build();

        Long productoId = Long.valueOf(body.get("producto").toString());
        Producto producto = productoRepository.findById(productoId).orElse(null);
        if (producto == null) return ResponseEntity.badRequest().body(Map.of("error", "Producto no encontrado"));

        ItemCatalogo item = new ItemCatalogo();
        item.setCatalogo(catalogo);
        item.setProducto(producto);
        BigDecimal precioBase = new BigDecimal(body.get("precioBase").toString());
        item.setPrecioBase(precioBase);
        item.setComision(precioBase.multiply(COMISION_BIDLY));
        item.setSubastado("no");
        return ResponseEntity.status(201).body(itemCatalogoRepository.save(item));
    }

    @GetMapping("/api/items/{id}")
    public ResponseEntity<ItemCatalogo> obtener(@PathVariable Long id) {
        return itemCatalogoRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/api/items/{id}/adjudicar")
    public ResponseEntity<?> adjudicar(@PathVariable Long id) {
        ItemAdjudicacionService.ManualAdjudicacionResult resultado = itemAdjudicacionService.adjudicarManual(id);

        return switch (resultado.estado()) {
            case NOT_FOUND -> ResponseEntity.notFound().build();
            case YA_ADJUDICADO -> ResponseEntity.badRequest()
                    .body(Map.of("error", "El ítem ya fue adjudicado"));
            case SIN_PUJAS -> ResponseEntity.badRequest()
                    .body(Map.of("error", "No hay pujas para este ítem"));
            case OK -> {
                ItemAdjudicacionService.AdjudicacionExitosa adj = resultado.datos();
                itemAdjudicacionService.cerrarSubastaSiCorresponde(adj.subastaId());
                yield ResponseEntity.ok(Map.of(
                        "ganadorClienteId", adj.ganadorClienteId(),
                        "importeFinal", adj.importeFinal(),
                        "comision", adj.comision(),
                        "itemId", adj.itemId()
                ));
            }
        };
    }
}
