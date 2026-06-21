package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.Catalogo;
import com.bidly.bidly_backend.model.Cliente;
import com.bidly.bidly_backend.model.ItemCatalogo;
import com.bidly.bidly_backend.model.Producto;
import com.bidly.bidly_backend.model.Puja;
import com.bidly.bidly_backend.model.RegistroDeSubasta;
import com.bidly.bidly_backend.model.Subasta;
import com.bidly.bidly_backend.repository.CatalogoRepository;
import com.bidly.bidly_backend.repository.ItemCatalogoRepository;
import com.bidly.bidly_backend.repository.ProductoRepository;
import com.bidly.bidly_backend.repository.PujaRepository;
import com.bidly.bidly_backend.repository.RegistroDeSubastaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
public class ItemCatalogoController {

    @Autowired
    private ItemCatalogoRepository itemCatalogoRepository;

    @Autowired
    private CatalogoRepository catalogoRepository;

    @Autowired
    private ProductoRepository productoRepository;

    @Autowired
    private PujaRepository pujaRepository;

    @Autowired
    private RegistroDeSubastaRepository registroRepository;

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
        item.setPrecioBase(new BigDecimal(body.get("precioBase").toString()));
        item.setComision(new BigDecimal(body.get("comision").toString()));
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
        ItemCatalogo item = itemCatalogoRepository.findById(id).orElse(null);
        if (item == null) return ResponseEntity.notFound().build();

        if ("si".equals(item.getSubastado())) {
            return ResponseEntity.badRequest().body(Map.of("error", "El ítem ya fue adjudicado"));
        }

        Puja mejorPuja = pujaRepository.findTopByItemIdentificadorOrderByImporteDesc(id).orElse(null);
        if (mejorPuja == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "No hay pujas para este ítem"));
        }

        // Marcar puja ganadora
        mejorPuja.setGanador("si");
        pujaRepository.save(mejorPuja);

        // Marcar ítem como subastado
        item.setSubastado("si");
        itemCatalogoRepository.save(item);

        // Crear registro de subasta
        Cliente ganador = mejorPuja.getAsistente().getCliente();
        Subasta subasta = item.getCatalogo().getSubasta();

        RegistroDeSubasta registro = new RegistroDeSubasta();
        registro.setSubasta(subasta);
        registro.setDuenio(item.getProducto().getDuenio());
        registro.setProducto(item.getProducto().getIdentificador());
        registro.setCliente(ganador);
        registro.setImporte(mejorPuja.getImporte());
        registro.setComision(item.getComision());
        registroRepository.save(registro);

        return ResponseEntity.ok(Map.of(
                "ganadorClienteId", ganador.getIdentificador(),
                "importeFinal", mejorPuja.getImporte(),
                "comision", item.getComision(),
                "itemId", item.getIdentificador()
        ));
    }
}
