package com.bidly.bidly_backend.service;

import com.bidly.bidly_backend.model.Cliente;
import com.bidly.bidly_backend.model.ItemCatalogo;
import com.bidly.bidly_backend.model.Puja;
import com.bidly.bidly_backend.model.RegistroDeSubasta;
import com.bidly.bidly_backend.model.RegistroPago;
import com.bidly.bidly_backend.model.Subasta;
import com.bidly.bidly_backend.repository.ItemCatalogoRepository;
import com.bidly.bidly_backend.repository.PujaRepository;
import com.bidly.bidly_backend.repository.RegistroDeSubastaRepository;
import com.bidly.bidly_backend.repository.RegistroPagoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Service
public class ItemAdjudicacionService {

    public enum Resultado {
        ADJUDICADO,
        CERRADO_SIN_PUJAS,
        YA_ADJUDICADO,
        SIN_PUJAS,
        NO_ENCONTRADO
    }

    public record AdjudicacionExitosa(
            Long ganadorClienteId,
            BigDecimal importeFinal,
            BigDecimal comision,
            Long itemId,
            Long subastaId
    ) {}

    public enum ManualEstado {
        OK, NOT_FOUND, YA_ADJUDICADO, SIN_PUJAS
    }

    public record ManualAdjudicacionResult(ManualEstado estado, AdjudicacionExitosa datos) {
        public static ManualAdjudicacionResult ok(AdjudicacionExitosa datos) {
            return new ManualAdjudicacionResult(ManualEstado.OK, datos);
        }
        public static ManualAdjudicacionResult of(ManualEstado estado) {
            return new ManualAdjudicacionResult(estado, null);
        }
    }

    @Autowired private ItemCatalogoRepository itemCatalogoRepository;
    @Autowired private PujaRepository pujaRepository;
    @Autowired private RegistroDeSubastaRepository registroDeSubastaRepository;
    @Autowired private RegistroPagoRepository registroPagoRepository;
    @Autowired private SubastaEstadoService subastaEstadoService;
    @Autowired private NotificacionService notificacionService;
    @Autowired private SubastaSesionService subastaSesionService;

    @Transactional
    public ManualAdjudicacionResult adjudicarManual(Long itemId) {
        ItemCatalogo item = itemCatalogoRepository.findByIdForUpdate(itemId).orElse(null);
        if (item == null) return ManualAdjudicacionResult.of(ManualEstado.NOT_FOUND);
        if ("si".equals(item.getSubastado())) return ManualAdjudicacionResult.of(ManualEstado.YA_ADJUDICADO);

        Optional<Puja> topPuja = pujaRepository.findTopByItemIdentificadorOrderByImporteDesc(itemId);
        if (topPuja.isEmpty()) return ManualAdjudicacionResult.of(ManualEstado.SIN_PUJAS);

        return ManualAdjudicacionResult.ok(adjudicarConPuja(item, topPuja.get(), true, itemId));
    }

    @Transactional
    public Resultado finalizarItem(Long itemId, boolean notificarGanador) {
        ItemCatalogo item = itemCatalogoRepository.findByIdForUpdate(itemId).orElse(null);
        if (item == null) return Resultado.NO_ENCONTRADO;
        if ("si".equals(item.getSubastado())) return Resultado.YA_ADJUDICADO;

        Optional<Puja> topPuja = pujaRepository.findTopByItemIdentificadorOrderByImporteDesc(itemId);
        if (topPuja.isEmpty()) {
            item.setSubastado("si");
            itemCatalogoRepository.save(item);
            avanzarSesionSiCorresponde(item.getCatalogo().getSubasta().getIdentificador(), itemId);
            return Resultado.CERRADO_SIN_PUJAS;
        }

        adjudicarConPuja(item, topPuja.get(), notificarGanador, itemId);
        return Resultado.ADJUDICADO;
    }

    private AdjudicacionExitosa adjudicarConPuja(ItemCatalogo item, Puja ganadora, boolean notificarGanador, Long itemId) {
        Subasta subasta = item.getCatalogo().getSubasta();

        ganadora.setGanador("si");
        pujaRepository.save(ganadora);

        item.setSubastado("si");
        itemCatalogoRepository.save(item);

        Long productoId = item.getProducto().getIdentificador();
        if (!registroDeSubastaRepository.existsBySubastaIdentificadorAndProducto(
                subasta.getIdentificador(), productoId)) {
            RegistroDeSubasta registro = new RegistroDeSubasta();
            registro.setSubasta(subasta);
            registro.setProducto(productoId);
            registro.setDuenio(item.getProducto().getDuenio());
            registro.setCliente(ganadora.getAsistente().getCliente());
            registro.setImporte(ganadora.getImporte());
            registro.setComision(item.getComision());
            registro = registroDeSubastaRepository.save(registro);

            BigDecimal comision = item.getComision() != null ? item.getComision() : BigDecimal.ZERO;
            RegistroPago pago = new RegistroPago();
            pago.setRegistro(registro.getIdentificador());
            pago.setEstado("pendiente");
            pago.setImporteTotal(ganadora.getImporte().add(comision));
            registroPagoRepository.save(pago);
        }

        Cliente ganador = ganadora.getAsistente().getCliente();
        if (notificarGanador) {
            String producto = item.getProducto().getDescripcionCatalogo();
            notificacionService.crear(ganador.getIdentificador(), "ganaste",
                    "Ganaste " + producto + " por $" + ganadora.getImporte());
        }

        avanzarSesionSiCorresponde(subasta.getIdentificador(), itemId);

        return new AdjudicacionExitosa(
                ganador.getIdentificador(),
                ganadora.getImporte(),
                item.getComision(),
                item.getIdentificador(),
                subasta.getIdentificador()
        );
    }

    private void avanzarSesionSiCorresponde(Long subastaId, Long itemId) {
        if (subastaSesionService.obtenerSesion(subastaId).isPresent()
                && subastaSesionService.esItemActivo(subastaId, itemId)) {
            subastaSesionService.avanzarItem(subastaId);
        }
    }

    @Transactional
    public void cerrarSubastaSiCorresponde(Long subastaId) {
        List<ItemCatalogo> items = itemCatalogoRepository.findByCatalogoSubastaIdentificador(subastaId);
        if (items.isEmpty()) return;

        boolean todosFinalizados = items.stream().allMatch(i -> "si".equals(i.getSubastado()));
        if (!todosFinalizados) {
            long pendientes = items.stream().filter(i -> !"si".equals(i.getSubastado())).count();
            if (pendientes == 1) {
                notificacionService.notificarAsistentesSubasta(subastaId, "subasta_por_cerrar",
                        "Queda 1 ítem en la subasta #" + subastaId + ". Pronto finalizará.");
            }
            return;
        }

        subastaEstadoService.finalizarSubasta(subastaId);
        notificacionService.notificarAsistentesSubasta(subastaId, "subasta_por_cerrar",
                "La subasta #" + subastaId + " finalizó.");
    }
}
